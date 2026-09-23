// Netlify Function: /.netlify/functions/facebook
// Fetches a public Facebook video/reel page and extracts a direct playable
// video URL along with basic metadata (title, thumbnail).
//
// Notes:
// - This only works for PUBLIC videos. If the owner restricted the video
//   (private, friends-only, age-gated, region-locked, or login-walled),
//   Facebook will not expose a direct video URL and this function returns
//   a clear error instead of a broken link.
// - Facebook sometimes serves a stripped-down "log in to continue" page to
//   requests that don't look like a real logged-in browser, even for
//   public content. To improve success, this function tries a few
//   different ways of reaching the same video before giving up:
//     1. The normal desktop page (www.facebook.com/...)
//     2. The mobile page (m.facebook.com/...)
//     3. Facebook's own public "embed" page, meant for embedding public
//        videos on other sites without login (facebook.com/plugins/video.php)
// - No API keys / npm packages required - uses the built-in `fetch`
//   available in the Netlify Node 18+ runtime.

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};

const MOBILE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

exports.handler = async (event) => {
  const url = event.queryStringParameters && event.queryStringParameters.url;

  if (!url) {
    return jsonResponse(400, { error: 'Missing "url" parameter.' });
  }

  if (!/facebook\.com|fb\.watch|fb\.com/i.test(url)) {
    return jsonResponse(400, { error: 'Please provide a valid Facebook URL.' });
  }

  try {
    const finalUrl = await resolveRedirect(url);

    // Try each strategy in turn until one produces a real video URL.
    const attempts = [
      () => fetchAndExtract(finalUrl, BROWSER_HEADERS),
      () => fetchAndExtract(toMobileUrl(finalUrl), MOBILE_HEADERS),
      () => fetchAndExtract(toEmbedUrl(finalUrl), BROWSER_HEADERS),
    ];

    let best = null;
    for (const attempt of attempts) {
      try {
        const data = await attempt();
        if (data && data.videoUrl) {
          best = data;
          break;
        }
        if (data && !best) best = data;
      } catch (e) {
        // Ignore and try the next strategy.
      }
    }

    if (!best || !best.videoUrl) {
      return jsonResponse(404, {
        error:
          'Video not available. It may be private, restricted by the owner, or the link is invalid.',
      });
    }

    return jsonResponse(200, {
      videoUrl: best.videoUrl,
      audioUrl: null,
      thumbnail: best.thumbnail,
      title: best.title,
      author: best.author,
      duration: best.duration,
    });
  } catch (err) {
    return jsonResponse(500, {
      error:
        'Failed to fetch this Facebook video. It may be private, restricted, or temporarily unavailable.',
    });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Facebook share links (facebook.com/share/r/xxxx, fb.watch/xxxx, /reel/xxxx)
// redirect to the canonical video/watch URL. Follow that redirect first.
async function resolveRedirect(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
    return res.url || url;
  } catch (e) {
    return url;
  }
}

function toMobileUrl(url) {
  try {
    const u = new URL(url);
    if (/^(www\.)?facebook\.com$/i.test(u.hostname)) {
      u.hostname = 'm.facebook.com';
    }
    return u.toString();
  } catch (e) {
    return url;
  }
}

function toEmbedUrl(url) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    url
  )}&show_text=false`;
}

async function fetchAndExtract(url, headers) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers,
  });
  if (!res.ok) {
    throw new Error(`Facebook returned status ${res.status}`);
  }
  const html = await res.text();
  return extractVideoData(html);
}

function unescapeFbString(str) {
  if (!str) return str;
  return str
    .replace(/\\\//g, '/')
    .replace(/\\u0025/g, '%')
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, '&');
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function firstMatch(html, patterns) {
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function findAnyMp4Url(html) {
  // Last resort: scan for any fbcdn-hosted .mp4 URL embedded anywhere in the
  // page's JSON, regardless of which key it's stored under. Facebook
  // changes its internal key names often, so this catches cases the
  // specific patterns above miss.
  const matches = html.match(/https:\\?\/\\?\/[^"'\s]*?\.mp4[^"'\s\\]*/g);
  if (!matches || !matches.length) return null;
  const fbcdn = matches.find((m) => /fbcdn\.net|video\.[a-z0-9.-]*\.fbcdn/i.test(m));
  return fbcdn || matches[0];
}

function extractVideoData(html) {
  // Try highest quality first, then fall back to standard definition.
  // Different Facebook page variants (desktop / mobile / embed) expose the
  // video URL under different key names, so we check all known variants.
  const hd = firstMatch(html, [
    /"browser_native_hd_url":"(.*?)"/,
    /"playable_url_quality_hd":"(.*?)"/,
    /hd_src:"(.*?)"/,
    /"hd_src":"(.*?)"/,
  ]);
  const sd = firstMatch(html, [
    /"browser_native_sd_url":"(.*?)"/,
    /"playable_url":"(.*?)"/,
    /sd_src:"(.*?)"/,
    /"sd_src":"(.*?)"/,
    /<video[^>]+src="(.*?)"/,
    /data-store="[^"]*?&quot;src&quot;:&quot;(.*?)&quot;/,
  ]);

  const videoUrl = unescapeFbString(hd) || unescapeFbString(sd) || unescapeFbString(findAnyMp4Url(html)) || null;

  const title = decodeHtmlEntities(
    firstMatch(html, [
      /<meta property="og:title" content="(.*?)"/,
      /<title>(.*?)<\/title>/,
    ])
  ) || 'Facebook Video';

  const thumbnail = unescapeFbString(
    firstMatch(html, [/<meta property="og:image" content="(.*?)"/])
  );

  const author =
    decodeHtmlEntities(
      firstMatch(html, [/<meta property="og:site_name" content="(.*?)"/])
    ) || '@facebook';

  return {
    videoUrl,
    thumbnail: thumbnail || '',
    title,
    author,
    duration: '0:00',
  };
}
