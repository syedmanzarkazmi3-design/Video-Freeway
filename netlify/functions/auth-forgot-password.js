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

  const email = (body.email || '').trim().toLowerCase();
  if (!email) {
    return jsonResponse(400, { error: 'Email is required.' });
  }

  try {
    const users = await readJSON(event, 'users', []);
    const user = users.find((u) => u.email === email);
    if (!user) {
      // Don't reveal whether the email exists — respond the same either way.
      return jsonResponse(200, { ok: true });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resets = await readJSON(event, 'resets', {});
    resets[email] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    await writeJSON(event, 'resets', resets);

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Video Freeway <onboarding@resend.dev>',
          to: [email],
          subject: 'Your Video Freeway password reset code',
          html: `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;">
            <h2 style="color:#FF4500;">Reset your password</h2>
            <p>Your verification code is:</p>
            <p style="font-size:32px;font-weight:900;letter-spacing:4px;">${code}</p>
            <p style="color:#64748b;font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
          </div>`,
        }),
      }).catch(() => {});
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to send reset code.' });
  }
};
