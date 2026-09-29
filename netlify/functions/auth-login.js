const { readJSON, jsonResponse } = require('./_lib/store');
const { verifyPassword, issueToken } = require('./_lib/auth');

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
  const password = body.password || '';

  if (!email || !password) {
    return jsonResponse(400, { error: 'Email and password are required.' });
  }

  try {
    const users = await readJSON(event, 'users', []);
    const user = users.find((u) => u.email === email);

    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return jsonResponse(401, { error: 'Incorrect email or password.' });
    }

    const token = issueToken(user.email, user.role);
    return jsonResponse(200, {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Login failed. Please try again.' });
  }
};
