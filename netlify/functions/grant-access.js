const { readJSON, writeJSON, jsonResponse } = require('./_lib/store');
const { requireRole } = require('./_lib/guard');

const ROLE_INFO = {
  viewer: {
    label: 'Viewer',
    perms: ['View analytics and site statistics', 'View download history', 'Read-only access (no editing)'],
  },
  manager: {
    label: 'Manager',
    perms: ['Everything a Viewer can do', 'Manage blogs and FAQs', 'View all registered users and their data', 'Access detailed analytics'],
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'Invalid request body' }); }

  const me = await requireRole(event, body.token, ['admin']);
  if (!me) return jsonResponse(403, { error: 'Admin access required.' });

  const targetEmail = (body.email || '').trim().toLowerCase();
  const role = (body.role || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) return jsonResponse(400, { error: 'Please enter a valid email address.' });
  if (!ROLE_INFO[role]) return jsonResponse(400, { error: 'Invalid access level.' });
  if (targetEmail === (process.env.ADMIN_EMAIL || '').toLowerCase().trim()) return jsonResponse(400, { error: 'That is the admin account already.' });

  try {
    const grants = await readJSON(event, 'grants', []);
    const now = new Date().toISOString();
    const existing = grants.find((g) => g.email === targetEmail);
    if (existing) { existing.role = role; existing.grantedAt = now; }
    else grants.push({ email: targetEmail, role, grantedAt: now, accepted: false });
    await writeJSON(event, 'grants', grants);

    // Already registered? Apply immediately.
    const users = await readJSON(event, 'users', []);
    const user = users.find((u) => u.email === targetEmail);
    if (user) {
      user.role = role;
      await writeJSON(event, 'users', users);
      const g = grants.find((x) => x.email === targetEmail);
      g.accepted = true;
      await writeJSON(event, 'grants', grants);
    }

    const mail = await sendGrantEmail(targetEmail, role, !!user);
    return jsonResponse(200, {
      ok: true,
      alreadyRegistered: !!user,
      emailSent: mail.sent,
      emailError: mail.error || null,
    });
  } catch (err) {
    return jsonResponse(500, { error: 'Failed to grant access.' });
  }
};

async function sendGrantEmail(toEmail, role, alreadyHasAccount) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not configured on the server.' };

  const info = ROLE_INFO[role];
  const siteUrl = (process.env.SITE_URL || 'https://watermarkfree.netlify.app').replace(/\/$/, '');
  const from = process.env.RESEND_FROM || 'Video Freeway <onboarding@resend.dev>';
  const perms = info.perms.map((p) => `<li style="margin:4px 0;">${esc(p)}</li>`).join('');
  const action = alreadyHasAccount
    ? 'You already have an account, so this is active now — just sign in again.'
    : `Sign up with this exact email address (<strong>${esc(toEmail)}</strong>) and the access will be applied automatically.`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1e293b;">
    <h2 style="color:#FF4500;margin-bottom:4px;">Video Freeway</h2>
    <p style="margin-top:0;color:#64748b;">Access permission granted</p>
    <p>You have been given <strong>${info.label}</strong> access on Video Freeway. This lets you:</p>
    <ul style="padding-left:20px;">${perms}</ul>
    <p>${action}</p>
    <p style="margin:24px 0;"><a href="${siteUrl}/?page=auth" style="background:#FF4500;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;">Open Video Freeway</a></p>
    <p style="font-size:12px;color:#94a3b8;">If you weren't expecting this, you can ignore this email.</p>
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [toEmail], subject: `Video Freeway: you've been granted ${info.label} access`, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${text}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message || 'Failed to send email.' };
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
