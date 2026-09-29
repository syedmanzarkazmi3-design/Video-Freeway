const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Lightweight signed session token: base64(email) + "." + HMAC-SHA256 signature.
// Verified against a server-only secret (SESSION_SECRET env var), so a client
// can't forge a token for an email it doesn't own without knowing the secret.
function getSecret() {
  return process.env.SESSION_SECRET || 'vf-dev-secret-change-me';
}

function issueToken(email, role) {
  const payload = Buffer.from(JSON.stringify({ email, role })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch (e) {
    return null;
  }
}

function isAdminToken(token) {
  const data = verifyToken(token);
  if (!data) return false;
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  return data.role === 'admin' && adminEmail && data.email.toLowerCase().trim() === adminEmail;
}

module.exports = { hashPassword, verifyPassword, issueToken, verifyToken, isAdminToken };
