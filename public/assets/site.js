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
  if (menu) menu.classList.toggle('hidden');
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

// Apply saved theme immediately (before the rest of the page renders) to
// avoid a flash of the wrong theme.
applyTheme();
