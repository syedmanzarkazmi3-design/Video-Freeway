const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    body = {};
  }

  const visitorId = (body.visitorId || '').trim();
  if (!visitorId) {
    return jsonResponse(400, { error: 'Missing visitorId' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const visitors = await readJSON(event, 'visitors', {});
    const isNewVisitorEver = !visitors[visitorId];

    if (isNewVisitorEver) {
      visitors[visitorId] = { firstSeen: today, lastSeen: today, visitDays: [today] };
    } else {
      const v = visitors[visitorId];
      v.lastSeen = today;
      if (!v.visitDays) v.visitDays = [];
      if (!v.visitDays.includes(today)) v.visitDays.push(today);
      if (v.visitDays.length > 30) v.visitDays = v.visitDays.slice(-30);
    }

    await writeJSON(event, 'visitors', visitors);

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to track visit' });
  }
};
