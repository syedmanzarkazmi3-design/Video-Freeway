const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');
const { hashPassword } = require('./_lib/auth');

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

  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  const newPassword = body.newPassword || '';

  if (!email || !code || !newPassword) {
    return jsonResponse(400, { error: 'Email, code and new password are required.' });
  }
  if (newPassword.length < 6) {
    return jsonResponse(400, { error: 'Password must be at least 6 characters.' });
  }

  try {
    const resets = await readJSON(event, 'resets', {});
    const pending = resets[email];

    if (!pending || pending.code !== code) {
      return jsonResponse(400, { error: 'Invalid code.' });
    }
    if (Date.now() > pending.expiresAt) {
      return jsonResponse(400, { error: 'Code expired. Please request a new one.' });
    }

    const users = await readJSON(event, 'users', []);
    const user = users.find((u) => u.email === email);
    if (!user) {
      return jsonResponse(404, { error: 'Account not found.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    await writeJSON(event, 'users', users);

    delete resets[email];
    await writeJSON(event, 'resets', resets);

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to reset password.' });
  }
};
