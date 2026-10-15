// Apply the saved theme before the page paints, so dark mode never flashes light first.
// The site starts light; "dark" is used only after a visitor picks it.
(() => {
  const root = document.documentElement;
  let choice = 'light';
  try { if (localStorage.getItem('theme') === 'dark') choice = 'dark'; } catch { /* storage blocked: stay light */ }
  const apply = () => {
    root.dataset.themeChoice = choice;
    root.dataset.theme = choice;
  };
  apply();
  window.setThemeChoice = value => {
    choice = value === 'dark' ? 'dark' : 'light';
    try {
      if (choice === 'dark') localStorage.setItem('theme', 'dark');
      else localStorage.removeItem('theme');
    } catch { /* still applies for this visit */ }
    apply();
  };
})();
