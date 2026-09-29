const { readJSON, jsonResponse } = require('./_lib/store');
const { requireRole } = require('./_lib/guard');

const dayKey = (d) => d.toISOString().split('T')[0];

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const params = event.queryStringParameters || {};
  const token = params.token || (event.headers && event.headers['x-vf-token']);
  const me = await requireRole(event, token, ['admin', 'manager', 'viewer']);
  if (!me) return jsonResponse(403, { error: 'Access denied.' });

  try {
    const [users, downloads, visitors] = await Promise.all([
      readJSON(event, 'users', []),
      readJSON(event, 'downloads', []),
      readJSON(event, 'visitors', {}),
    ]);

    const today = dayKey(new Date());
    const visitorIds = Object.keys(visitors);

    const platformCounts = {};
    for (const d of downloads) {
      const k = (d.platform || 'unknown').toLowerCase();
      platformCounts[k] = (platformCounts[k] || 0) + 1;
    }
    let mostUsedPlatform = '-';
    let best = 0;
    for (const [k, v] of Object.entries(platformCounts)) if (v > best) { best = v; mostUsedPlatform = k; }

    const last7 = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(dayKey(d)); }
    const dailyDownloads = last7.map((date) => ({ date, count: downloads.filter((x) => x.date.startsWith(date)).length }));
    const dailyVisitors = last7.map((date) => ({ date, count: visitorIds.filter((id) => (visitors[id].visitDays || []).includes(date)).length }));

    // Optional date-range filter for the Analytics tab.
    const from = params.from || '';
    const to = params.to || '';
    const filtered = downloads.filter((d) => {
      const day = d.date.split('T')[0];
      return (!from || day >= from) && (!to || day <= to);
    });
    const fPlatforms = {};
    const fDaily = {};
    for (const d of filtered) {
      const k = (d.platform || 'unknown').toLowerCase();
      fPlatforms[k] = (fPlatforms[k] || 0) + 1;
      const day = d.date.split('T')[0];
      fDaily[day] = (fDaily[day] || 0) + 1;
    }

    const perUser = {};
    for (const d of downloads) if (d.userEmail) perUser[d.userEmail] = (perUser[d.userEmail] || 0) + 1;

    const canSeeUsers = me.role === 'admin' || me.role === 'manager';
    const usersSafe = canSeeUsers
      ? users
          .map((u) => ({
            name: u.name, email: u.email, createdAt: u.createdAt,
            role: u.email === (process.env.ADMIN_EMAIL || '').toLowerCase().trim() ? 'admin' : u.role,
            downloads: perUser[u.email] || 0,
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : [];

    return jsonResponse(200, {
      role: me.role,
      totalUsers: users.length,
      totalUniqueVisitors: visitorIds.length,
      visitorsToday: visitorIds.filter((id) => visitors[id].lastSeen === today).length,
      totalDownloads: downloads.length,
      downloadsToday: downloads.filter((d) => d.date.startsWith(today)).length,
      mostUsedPlatform,
      platformCounts,
      dailyDownloads,
      dailyVisitors,
      filtered: {
        total: filtered.length,
        uniqueUsers: new Set(filtered.map((d) => d.visitorId)).size,
        platformCounts: fPlatforms,
        daily: Object.keys(fDaily).sort().map((date) => ({ date, count: fDaily[date] })),
      },
      users: usersSafe,
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to load data' });
  }
};
