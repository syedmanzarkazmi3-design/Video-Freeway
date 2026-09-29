// Shared helper for reading/writing our app's data in Netlify Blobs.
// All data lives in one store ("vf-data") under a few fixed keys:
//   users      -> array of { id, name, email, passwordHash, passwordSalt, role, createdAt }
//   downloads  -> array of { platform, title, date, visitorId, userEmail }
//   visitors   -> object map { visitorId: firstSeenDateISO }
//   grants     -> array of { email, permissions, grantedAt, token, accepted }
//
// Netlify Blobs is eventually consistent (updates can take up to ~60s to
// propagate) and there's no built-in row-level locking, so under heavy
// concurrent writes a read-modify-write could race. That's an acceptable
// tradeoff at this site's scale.

const { getStore, connectLambda } = require('@netlify/blobs');

function store(event) {
  // connectLambda wires up the Blobs environment when running in AWS Lambda
  // compatibility mode (the default for Netlify Functions using this
  // handler style). Safe to call even if already connected.
  if (event) {
    try {
      connectLambda(event);
    } catch (e) {
      // already connected / not needed in this runtime - ignore
    }
  }
  return getStore('vf-data');
}

async function readJSON(event, key, fallback) {
  const s = store(event);
  try {
    const value = await s.get(key, { type: 'json' });
    return value === null || value === undefined ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

async function writeJSON(event, key, value) {
  const s = store(event);
  await s.setJSON(key, value);
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

module.exports = { readJSON, writeJSON, jsonResponse };
