// Role check for protected endpoints. The token only proves *who* the caller
// is (signed by the server); the caller's *current* role is always looked up
// in the users store, so a role change (e.g. after Grant Access) takes effect
// immediately without trusting anything the client sends.
const { readJSON } = require('./store');
const { verifyToken } = require('./auth');

async function requireRole(event, token, allowedRoles) {
  const data = verifyToken(token);
  if (!data || !data.email) return null;
  const email = String(data.email).toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();

  const users = await readJSON(event, 'users', []);
  const user = users.find((u) => u.email === email);
  if (!user) return null;

  const role = email === adminEmail ? 'admin' : user.role;
  if (!allowedRoles.includes(role)) return null;
  return { email: user.email, name: user.name, role };
}

module.exports = { requireRole };
