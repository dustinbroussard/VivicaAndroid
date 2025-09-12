(function () {
  // SPA GitHub Pages redirect support: decode ?p=originalPath from 404.html
  try {
    var params = new URLSearchParams(window.location.search);
    var encodedPath = params.get('p');
    if (encodedPath) {
      var target = decodeURIComponent(encodedPath);
      var newUrl = target;
      // Preserve hash if present separately
      var hash = window.location.hash || '';
      if (hash && newUrl.indexOf('#') === -1) newUrl += hash;
      window.history.replaceState(null, '', newUrl);
    }
  } catch {}

  // Set initial theme-color for Android status bar in PWA and web views
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
