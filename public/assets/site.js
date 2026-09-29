// Shared site-wide chrome behavior used by every page: theme toggle,
// mobile menu, and the mobile "Downloaders" submenu.

function applyTheme() {
  const theme = localStorage.getItem('vf_theme') || 'light';
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.classList.contains('dark') ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  html.classList.remove(current);
  html.classList.add(next);
  localStorage.setItem('vf_theme', next);
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const pill = document.getElementById('navPill');
  if (menu) menu.classList.toggle('hidden');
  if (pill) {
    const isOpen = menu && !menu.classList.contains('hidden');
    pill.classList.toggle('rounded-full', !isOpen);
    pill.classList.toggle('rounded-3xl', isOpen);
  }
}

function toggleMobileDownloaders(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('mobileDownloadersMenu');
  const icon = document.getElementById('mobileDownloadersIcon');
  if (!menu) return;
  menu.classList.toggle('open');
  if (icon) icon.style.transform = menu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleNavDownloadersMobile(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('navDownloadersMobileMenu');
  const icon = document.getElementById('navDownloadersMobileIcon');
  if (!menu) return;
  menu.classList.toggle('open');
  if (icon) icon.style.transform = menu.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
}

document.addEventListener('click', function(event) {
  const menu = document.getElementById('navDownloadersMobileMenu');
  if (menu && menu.classList.contains('open') && !menu.parentElement.contains(event.target)) {
    menu.classList.remove('open');
  }
});

// ---- Ad blocker detection ----
// Uses a "bait" element with class names commonly targeted by ad-blocker
// cosmetic filters (adsbox, ad-banner, adsbygoogle, etc). If an ad blocker
// hides/removes it, we show a full-screen notice. We keep checking every
// second, and reload the page automatically the moment the bait element
// becomes visible again (i.e. the ad blocker was turned off).
function isAdBlockerActive() {
  const bait = document.getElementById('adblock-bait');
  if (!bait) return false;
  const style = window.getComputedStyle(bait);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    bait.offsetHeight === 0 ||
    bait.offsetParent === null ||
    bait.clientHeight === 0
  );
}

function initAdBlockDetection() {
  const overlay = document.getElementById('adblockOverlay');
  if (!overlay) return;
  setTimeout(function () {
    if (isAdBlockerActive()) {
      overlay.classList.remove('hidden');
      document.documentElement.style.overflow = 'hidden';
      const interval = setInterval(function () {
        if (!isAdBlockerActive()) {
          clearInterval(interval);
          location.reload();
        }
      }, 1000);
    }
  }, 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdBlockDetection);
} else {
  initAdBlockDetection();
}


// ---- Real visitor tracking (shared by every page) ----
// A random anonymous id is created once per browser and reused, so the same
// person counts as ONE unique visitor no matter how many pages/days they visit.
function getVisitorId() {
  let id = localStorage.getItem('vf_visitor_id');
  if (!id) {
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    localStorage.setItem('vf_visitor_id', id);
  }
  return id;
}

function trackVisit() {
  const flag = 'vf_visit_' + new Date().toISOString().split('T')[0];
  if (sessionStorage.getItem(flag)) return; // once per tab-session per day
  sessionStorage.setItem(flag, '1');
  fetch('/.netlify/functions/track-visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId: getVisitorId() }),
  }).catch(function () {});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', trackVisit);
} else {
  trackVisit();
}

// Apply saved theme immediately (before the rest of the page renders) to
// avoid a flash of the wrong theme.
applyTheme();
