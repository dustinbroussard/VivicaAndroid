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

  // Convert "H S% L%" to hex for meta theme-color
  function hslToHex(hsl) {
    try {
      var match = String(hsl).match(/\d+(?:\.\d+)?/g);
      if (!match || match.length < 3) return null;
      var h = parseFloat(match[0]);
      var s = parseFloat(match[1]) / 100;
      var l = parseFloat(match[2]) / 100;
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      var m = l - c / 2;
      var r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      var toHex = function (n) { var v = Math.round((n + m) * 255); return v.toString(16).padStart(2, '0'); };
      return '#' + toHex(r) + toHex(g) + toHex(b);
    } catch { return null; }
  }

  // Map of theme background HSLs to get a good initial status bar color
  var BG_HSL_BY_THEME = {
    'default-dark': '0 0% 0%',
    'default-light': '0 0% 100%',
    'blue-dark': '225 100% 4%',
    'blue-light': '210 100% 95%',
    'red-dark': '0 100% 4%',
    'red-light': '15 100% 95%',
    'green-dark': '150 100% 4%',
    'green-light': '120 100% 95%',
    'purple-dark': '280 100% 4%',
    'purple-light': '270 100% 95%',
    'mardi-gold-dark': '0 0% 0%',
    'mardi-gold-light': '0 0% 100%',
    'mardi-gras-dark': '0 0% 4%',
    'mardi-gras-light': '0 0% 100%'
  };

  function setAllThemeColorMetas(hex) {
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function (el) { el.setAttribute('content', hex); });
  }

  // Set initial theme-color for Android status bar in PWA and web views
  try {
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var color = 'default';
    var variant = prefersDark ? 'dark' : 'light';

    var storedRaw = null;
    try { storedRaw = localStorage.getItem('vivica-theme'); } catch {}
    if (storedRaw) {
      try {
        var stored = JSON.parse(storedRaw);
        if (stored && typeof stored === 'object') {
          if (stored.color && typeof stored.color === 'string') color = stored.color;
          if (stored.variant === 'dark' || stored.variant === 'light') variant = stored.variant;
        }
      } catch {}
    }

    var key = (color + '-' + variant);
    var hsl = BG_HSL_BY_THEME[key] || (variant === 'dark' ? '0 0% 0%' : '0 0% 100%');
    var hex = hslToHex(hsl) || (variant === 'dark' ? '#000000' : '#ffffff');
    setAllThemeColorMetas(hex);
  } catch {}
})();
