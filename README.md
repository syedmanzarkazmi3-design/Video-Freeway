# Video Freeway — Deploy Guide

## Folder structure
```
video-freeway/
├── netlify.toml
├── public/
│   ├── index.html          <- landing page (home, blogs, FAQ, auth, admin, dashboard)
│   ├── tiktok.html          <- TikTok downloader page
│   ├── youtube.html         <- YouTube downloader page
│   ├── facebook.html        <- Facebook downloader page
│   ├── pinterest.html       <- Pinterest downloader page
│   └── assets/
│       ├── logo.png         <- shared logo (used by every page)
│       ├── style.css        <- shared styles (used by every page)
│       ├── site.js          <- shared header/theme/menu behavior
│       ├── downloader.js    <- shared analyze/download logic (single-platform mode)
│       └── reviews.js       <- fake reviews data + marquee renderer (homepage only)
└── netlify/
    └── functions/
        ├── facebook.js       <- serverless function (Facebook video extraction)
        └── pinterest.js      <- serverless function (Pinterest video extraction)
```

## Important: how to deploy this time
This site needs **serverless functions** (for Facebook and Pinterest), so a simple
drag-and-drop of HTML files (like the very first time) will NOT run them. Use one
of these two methods instead:

### Option A — Netlify CLI (fastest, recommended)
1. Install once: `npm install -g netlify-cli`
2. Open a terminal inside this `video-freeway` folder.
3. Run: `netlify deploy --prod`
4. When asked, choose your existing site (videofreeeway) or create a new one,
   and confirm the publish directory is `public`.

### Option B — Connect a Git repo (GitHub/GitLab)
1. Push this whole folder (including `netlify.toml` and the `netlify`
   functions folder) to a new GitHub repo.
2. In Netlify dashboard → "Add new site" → "Import an existing project" →
   connect that repo.
3. Build settings are already set via `netlify.toml`
   (publish = `public`, functions = `netlify/functions`) — no changes needed.
4. Deploy.

Either way, after deploy check that this URL responds with JSON (not a 404):
`https://YOURSITE.netlify.app/.netlify/functions/facebook?url=test`

## What changed / how it works now

- **Site structure** — The site is now multi-page: `index.html` is the landing
  page (choose-a-downloader cards, features, reviews, FAQ, plus the full
  account system — sign in, blogs, FAQ management, admin panel, dashboard).
  Each downloader tool has its own dedicated page (`tiktok.html`,
  `youtube.html`, `facebook.html`, `pinterest.html`) reachable from the
  "Downloaders" dropdown in the header (hover on desktop, tap on mobile) or
  from the cards on the homepage.
- **TikTok** — unchanged, still uses the public tikwm.com API directly from
  the browser (this already worked, was not touched).
- **YouTube** — no backend needed. The app fetches the video's title/
  thumbnail/author from YouTube's own oEmbed endpoint, falling back to
  `noembed.com`, and finally to YouTube's public thumbnail CDN if both of
  those fail — so a valid YouTube link basically never fails to show a
  preview. Clicking any download button opens the *same* YouTube video in a
  new tab (never on Analyze, only when a download button is clicked) so the
  user can save it from YouTube directly — watermark isn't a concern here
  per your instructions.
- **Facebook** — uses `netlify/functions/facebook.js`. It tries three ways of
  reaching the same video (normal page, mobile page, and Facebook's own
  public embed page) and keeps whichever attempt finds the *highest quality*
  video link, not just the first one that finds anything — this avoids
  settling for a low-quality preview clip when the real HD source was
  reachable via a different attempt.
  - Public videos with no owner restrictions → real HD/SD video URL is
    returned and the "Full HD / HD / Audio" buttons will download the
    actual video file.
  - Private / friends-only / restricted / age-gated / region-locked videos
    → Facebook does not expose a direct video URL, so the function returns
    a clear error ("Video not available. It may be private, restricted by
    the owner...") instead of a broken link.
  - Facebook's anti-bot protections change over time, so 100% success on
    every video can't be guaranteed by this or any free tool — but this
    gives it several fallback paths to try.
- **Pinterest** — uses `netlify/functions/pinterest.js`, same approach as
  Facebook: fetches the public Pin page and extracts the video URL from
  Pinterest's embedded JSON (checking the highest-quality key first). Only
  works for Pins that actually contain a video (not photo-only Pins) and
  that the owner hasn't restricted.
- **Grant Access bug fix** — previously, *any* logged-in user (not just
  admin) could see and open "Grant Access" in the account menu. This is now
  correctly hidden unless the logged-in user's role is `admin`.
- **Mobile header** — the logo and site name are now always visible on
  mobile (were hidden before), and a "Downloaders" button sits next to
  "Sign In" in the mobile header row.
