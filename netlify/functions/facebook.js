// Netlify Function: /.netlify/functions/facebook
// Fetches a public Facebook video/reel page and extracts a direct playable
// video URL along with basic metadata (title, thumbnail).
//
// Notes:
// - This only works for PUBLIC videos. If the owner restricted the video
//   (private, friends-only, age-gated, region-locked, or login-walled),
//   Facebook will not expose a direct video URL in the page source and
//   this function will return a clear error instead of a broken link.
// - No API keys / npm packages required - uses the built-in `fetch`
//   available in the Netlify Node 18+ runtime.

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
    const html = await fetchHtml(finalUrl);
    const data = extractVideoData(html);

    if (!data.videoUrl) {
      return jsonResponse(404, {
        error:
          'Video not available. It may be private, restricted by the owner, or the link is invalid.',
      });
    }

    return jsonResponse(200, {
      videoUrl: data.videoUrl,
      audioUrl: null,
      thumbnail: data.thumbnail,
      title: data.title,
      author: data.author,
      duration: data.duration,
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

async function fetchHtml(url) {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: BROWSER_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Facebook returned status ${res.status}`);
  }
  return await res.text();
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

function extractVideoData(html) {
  // Try highest quality first, then fall back to standard definition.
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
  ]);

  const videoUrl = unescapeFbString(hd) || unescapeFbString(sd) || null;

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
