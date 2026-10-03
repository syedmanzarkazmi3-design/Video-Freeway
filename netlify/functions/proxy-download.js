// Netlify Function: /.netlify/functions/proxy-download
// Some CDNs (notably Pinterest's pinimg.com/v1.pinimg.com) don't allow
// cross-origin fetch() from the browser, so a direct client-side download
// fails silently and the site falls back to opening the video in a new tab
// instead of actually downloading it. This function fetches the video
// server-side (no CORS restrictions apply server-to-server) and streams
// the bytes back with a Content-Disposition header, so a plain browser
// navigation to this URL triggers a real file download.

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const url = params.url;
  const filename = (params.filename || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!url) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  // Only allow proxying from known video CDNs, to avoid this becoming an
  // open relay for arbitrary URLs.
  const allowedHosts = /pinimg\.com|fbcdn\.net|tiktokcdn|tiktok\.com/i;
  if (!allowedHosts.test(url)) {
    return { statusCode: 400, body: 'URL not allowed' };
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return { statusCode: 502, body: 'Failed to fetch video from source' };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'video/mp4';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, body: 'Proxy download failed' };
  }
};
