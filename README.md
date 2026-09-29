# Video Freeway — Deploy Guide

## Folder structure
```
video-freeway/
├── netlify.toml
├── package.json              <- NEW: tells Netlify to install @netlify/blobs
├── public/
│   ├── index.html
│   ├── tiktok.html / youtube.html / facebook.html / pinterest.html
│   ├── llms.txt, robots.txt, sitemap.xml
│   └── assets/ (logo, css, shared js)
└── netlify/
    └── functions/
        ├── _lib/                    <- shared helpers (store, auth, guard)
        ├── facebook.js, pinterest.js  <- video extraction (unchanged)
        ├── auth-signup.js, auth-login.js
        ├── auth-forgot-password.js, auth-reset-password.js
        ├── track-visit.js, track-download.js
        ├── get-my-data.js, get-admin-data.js
        ├── grant-access.js, set-role.js
```

## What's new: a REAL shared backend
Previously, "users", "downloads" and "analytics" only lived in each visitor's
own browser (localStorage) — that's why your dashboard only ever showed
yourself. Now all of that lives in **Netlify Blobs**, a real shared data
store built into Netlify, so:
- Every signup, every download, every visit — from anyone, on any device —
  shows up live in your Admin Panel.
- Passwords are hashed (not stored as plain text like before).
- Roles (`admin` / `manager` / `viewer` / `user`) are enforced by the
  server, not just hidden in the UI.

## Required setup after deploying (one-time)
Netlify needs 3 environment variables. In the Netlify dashboard for this
site: **Project configuration → Environment variables → Add a variable**,
add all three:

| Key | Value | Why |
|---|---|---|
| `ADMIN_EMAIL` | your own email (the one you sign up with) | Whoever signs up with this exact email automatically becomes `admin`. |
| `SESSION_SECRET` | any long random string, e.g. `k3f9-a7x2-mQ8p-zR4t-...` | Used to sign login sessions. Keep it secret; don't reuse a real password. |
| `RESEND_API_KEY` | the API key from resend.com | Used to send "Grant Access" and password-reset emails. |

After adding these, go to **Deploys → Trigger deploy → Deploy site** once so
Netlify picks them up (env vars only apply to deploys made after you save them).

⚠️ **Enable Netlify Blobs**: Blobs should work automatically once
`@netlify/blobs` is installed (via `package.json`, already included) — no
extra dashboard toggle needed on modern Netlify projects.

## How to deploy this update
Same as before (GitHub Desktop → replace files → Commit → Push), but this
time **replace everything**: `public`, `netlify`, `netlify.toml`, and also
add the new `package.json` file to the repo root (it wasn't there before).

After pushing, check the deploy log in Netlify (Deploys → click the latest
deploy → Deploy log) — you should see a line about installing npm
dependencies. If that step fails, it's almost always because `package.json`
didn't get committed to the repo root — double check it's there, right next
to `netlify.toml`.

## Roles explained
- **admin** — you. Full access: Grant Access, change anyone's role, see everything.
- **manager** — can view all users' data and full analytics (granted by admin).
- **viewer** — can view analytics/stats, read-only (granted by admin).
- **user** — a normal signed-up visitor; sees only their own download history.

## Other notes
- TikTok — unchanged, uses the public tikwm.com API directly from the browser.
- YouTube — no backend needed; downloads open the video on YouTube itself.
- Facebook / Pinterest — serverless functions scrape the public page for a
  direct video URL. Only works for public, unrestricted content.
- Ad-blocker wall — shows automatically if a visitor has an ad blocker on.
  It currently has no real ads behind it — once you add a real ad network
  (e.g. Google AdSense), this will make full sense to visitors.
