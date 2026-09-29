const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  const platform = (body.platform || '').trim();
  const title = (body.title || 'Untitled').trim().slice(0, 200);
  const visitorId = (body.visitorId || '').trim();
  const userEmail = (body.userEmail || '').trim().toLowerCase();
  const quality = (body.quality || '').trim().slice(0, 20);

  if (!platform || !visitorId) {
    return jsonResponse(400, { error: 'Missing platform or visitorId' });
  }

  try {
    const downloads = await readJSON(event, 'downloads', []);
    downloads.push({
      platform,
      title,
      date: new Date().toISOString(),
      visitorId,
      quality,
      userEmail: userEmail || null,
    });

    // Keep the list from growing forever — cap at the most recent 5000 entries.
    const trimmed = downloads.length > 5000 ? downloads.slice(downloads.length - 5000) : downloads;
    await writeJSON(event, 'downloads', trimmed);

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to track download' });
  }
};
