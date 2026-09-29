const { readJSON, jsonResponse } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const params = event.queryStringParameters || {};
  const visitorId = (params.visitorId || '').trim();
  const email = (params.email || '').trim().toLowerCase();

  if (!visitorId && !email) {
    return jsonResponse(400, { error: 'Missing visitorId or email' });
  }

  try {
    const downloads = await readJSON(event, 'downloads', []);
    const mine = downloads.filter(
      (d) => (visitorId && d.visitorId === visitorId) || (email && d.userEmail === email)
    );

    const counts = { tiktok: 0, youtube: 0, facebook: 0, pinterest: 0 };
    for (const d of mine) {
      const key = (d.platform || '').toLowerCase();
      if (counts[key] !== undefined) counts[key]++;
    }

    const sorted = mine.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    return jsonResponse(200, {
      total: mine.length,
      counts,
      history: sorted.slice(0, 50).map((d) => ({ date: d.date, platform: d.platform, title: d.title, quality: d.quality || '' })),
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to load dashboard data' });
  }
};
