const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');
const { requireRole } = require('./_lib/guard');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'Invalid request body' }); }

  const me = await requireRole(event, body.token, ['admin']);
  if (!me) return jsonResponse(403, { error: 'Admin access required.' });

  const email = (body.email || '').trim().toLowerCase();
  const role = (body.role || '').trim().toLowerCase();
  if (!['user', 'viewer', 'manager'].includes(role)) return jsonResponse(400, { error: 'Invalid role.' });
  if (email === (process.env.ADMIN_EMAIL || '').toLowerCase().trim()) return jsonResponse(400, { error: 'The admin role cannot be changed.' });

  try {
    const users = await readJSON(event, 'users', []);
    const user = users.find((u) => u.email === email);
    if (!user) return jsonResponse(404, { error: 'User not found.' });
    user.role = role;
    await writeJSON(event, 'users', users);
    return jsonResponse(200, { ok: true });
  } catch (e) {
    return jsonResponse(500, { error: 'Failed to update role.' });
  }
};
