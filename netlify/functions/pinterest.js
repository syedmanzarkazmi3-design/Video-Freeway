// Netlify Function: /.netlify/functions/pinterest
// Fetches a public Pinterest Pin page and extracts the direct video URL
// along with basic metadata (title, thumbnail).
//
// Notes:
// - Only works for public Pins that contain a video. Image-only Pins or
//   Pins the owner has restricted will not have a video URL and this
//   function returns a clear error instead of a broken link.
// - Pinterest embeds video data in a large JSON blob inside the page,
//   under video quality keys like "V_720P", "V_EXP7", "V_HLSV4" etc, each
//   pointing at a v1.pinimg.com / v.pinimg.com .mp4 URL. This function
//   checks the common quality keys first (highest first) and falls back
//   to a generic pinimg video URL scan if the exact keys aren't found.
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

  if (!/pinterest\.[a-z.]+|pin\.it/i.test(url)) {
    return jsonResponse(400, { error: 'Please provide a valid Pinterest URL.' });
  }

  try {
    const finalUrl = await resolveRedirect(url);
    const html = await fetchHtml(finalUrl);
    const data = extractVideoData(html);

    if (!data.videoUrl) {
      return jsonResponse(404, {
        error:
          'Video not available. This Pin may not contain a video, or it may be private or restricted.',
      });
    }

    return jsonResponse(200, {
      videoUrl: data.videoUrl,
      thumbnail: data.thumbnail,
      title: data.title,
      author: data.author,
      duration: data.duration,
    });
  } catch (err) {
    return jsonResponse(500, {
      error:
        'Failed to fetch this Pinterest video. It may be private, restricted, or temporarily unavailable.',
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

// Pinterest short links (pin.it/xxxx) redirect to the canonical pin page.
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
    throw new Error(`Pinterest returned status ${res.status}`);
  }
  return await res.text();
}

function unescapeUrl(str) {
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

function findAnyPinimgVideo(html) {
  const matches = html.match(/https:\\?\/\\?\/v[0-9]?\.pinimg\.com[^"'\s\\]*?\.mp4[^"'\s\\]*/gi);
  if (!matches || !matches.length) return null;
  // Prefer whichever match mentions a higher resolution folder (720p over 480p, etc.)
  const byQuality = matches.sort((a, b) => {
    const score = (s) => {
      if (/1080p/i.test(s)) return 4;
      if (/720p/i.test(s)) return 3;
      if (/480p/i.test(s)) return 2;
      if (/240p/i.test(s)) return 1;
      return 0;
    };
    return score(b) - score(a);
  });
  return byQuality[0];
}

function extractVideoData(html) {
  const videoKeyed = firstMatch(html, [
    /"V_1080P"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
    /"V_720P"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
    /"V_EXP7"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
    /"V_HLSV4"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
    /"V_480P"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
    /"V_240P"\s*:\s*\{\s*"url"\s*:\s*"(.*?)"/,
  ]);

  const videoUrl =
    unescapeUrl(videoKeyed) || unescapeUrl(findAnyPinimgVideo(html)) || null;

  const title = decodeHtmlEntities(
    firstMatch(html, [
      /<meta property="og:title" content="(.*?)"/,
      /<title>(.*?)<\/title>/,
    ])
  ) || 'Pinterest Video';

  const thumbnail = unescapeUrl(
    firstMatch(html, [/<meta property="og:image" content="(.*?)"/])
  );

  const author =
    decodeHtmlEntities(
      firstMatch(html, [
        /<meta property="og:site_name" content="(.*?)"/,
        /"pinner"\s*:\s*\{\s*"username"\s*:\s*"(.*?)"/,
      ])
    ) || '@pinterest';

  return {
    videoUrl,
    thumbnail: thumbnail || '',
    title,
    author,
    duration: '0:00',
  };
}
