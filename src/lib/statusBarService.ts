import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

function hslToHex(hsl: string): string | null {
  const match = hsl.match(/\d+(?:\.\d+)?/g);
  if (!match || match.length < 3) return null;
  const h = parseFloat(match[0]);
  const s = parseFloat(match[1]) / 100;
  const l = parseFloat(match[2]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const v = Math.round((n + m) * 255);
    return v.toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function getColors(): { bg: string | null } {
  const style = getComputedStyle(document.documentElement);
  // Prefer the canonical background token for status bar color
  const bg =
    hslToHex(style.getPropertyValue('--background').trim()) ||
    hslToHex(style.getPropertyValue('--bg-primary').trim()) ||
    null;
  return { bg };
}

export async function applyStatusBarTheme(variant: 'light' | 'dark') {
  const { bg } = getColors();
  const background = bg ?? (variant === 'dark' ? '#000000' : '#FFFFFF');

  // Update PWA/browser theme color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', background);
  }

  if (Capacitor.isNativePlatform()) {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: background });

    // Choose icon style based on background luminance.
    // Dark background => light icons; Light background => dark icons.
    const isDarkBg = getLuminance(background) < 0.5;
    // Dark background -> light icons; Light background -> dark icons
    const style = isDarkBg ? Style.Light : Style.Dark;
    await StatusBar.setStyle({ style });
  }
}
