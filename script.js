// Start at the top on entry; keep section links working after the page opens.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) {
  try {
    history.replaceState(history.state, '', location.pathname + location.search);
  } catch {
    location.hash = 'top';
  }
}
function startAtTop() {
  if (!location.hash || location.hash === '#top') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
}
startAtTop();
window.addEventListener('pageshow', startAtTop, { once: true });

const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
  menu.textContent = open ? '×' : '☰';
});
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '☰';
  menu.setAttribute('aria-label', 'เปิดเมนู');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) {
    menu.click();
    menu.focus();
  }
});
const shortcuts = document.querySelectorAll('.mobile-dock a');
function updateShortcut() {
  const current = location.hash || '#top';
  shortcuts.forEach(link => {
    if (link.getAttribute('href') === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', updateShortcut);
updateShortcut();
