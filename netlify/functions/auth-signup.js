const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');
const { hashPassword, issueToken } = require('./_lib/auth');
const crypto = require('crypto');

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

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!name || !email || !password) {
    return jsonResponse(400, { error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return jsonResponse(400, { error: 'Password must be at least 6 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { error: 'Please enter a valid email address.' });
  }

  try {
    const users = await readJSON(event, 'users', []);

    if (users.some((u) => u.email === email)) {
      return jsonResponse(409, { error: 'An account with this email already exists.' });
    }

    const { hash, salt } = hashPassword(password);

    // If this email was previously granted admin access, honor it now.
    const grants = await readJSON(event, 'grants', []);
    const grant = grants.find((g) => g.email === email);
    const role = grant ? grant.role || 'viewer' : 'user';

    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const finalRole = email === adminEmail ? 'admin' : role;

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: finalRole,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await writeJSON(event, 'users', users);

    if (grant) {
      grant.accepted = true;
      grant.acceptedAt = new Date().toISOString();
      await writeJSON(event, 'grants', grants);
    }

    const token = issueToken(user.email, user.role);
    return jsonResponse(200, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Signup failed. Please try again.' });
  }
};
