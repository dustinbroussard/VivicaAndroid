(function () {
  var metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) return;
  try {
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    var variant = prefersDark && prefersDark.matches ? 'dark' : 'light';
    var storedRaw = localStorage.getItem('vivica-theme');
    if (storedRaw) {
      try {
        var stored = JSON.parse(storedRaw);
        if (stored && (stored.variant === 'dark' || stored.variant === 'light')) {
          variant = stored.variant;
        }
      } catch {}
    }
    metaThemeColor.setAttribute('content', variant === 'dark' ? '#000000' : '#FFFFFF');
  } catch {}
})();
