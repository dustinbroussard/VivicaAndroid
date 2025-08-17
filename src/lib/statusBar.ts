import { StatusBar, Style } from '@capacitor/status-bar'

/** Relative luminance (WCAG) to decide light/dark icons */
function isDarkBg(hex: string): boolean {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // Dark if luminance is low
  return L < 0.5
}

export type ThemeFamily = 'default' | 'red' | 'blue' | 'green' | 'purple' | 'mardi-gold'
export type ThemeMode = 'light' | 'dark'
export type ThemeKey = `${ThemeFamily}-${ThemeMode}`

/** Pick your exact status bar background per theme variant */
const STATUSBAR_BG: Record<ThemeKey, string> = {
  // Default (Black / White)
  'default-dark': '#000000',
  'default-light': '#FFFFFF',
  // Red
  'red-dark': '#7A0E1B',
  'red-light': '#FFD5D9',
  // Blue
  'blue-dark': '#0A1C3A',
  'blue-light': '#DDE9FF',
  // Green
  'green-dark': '#0F2D1E',
  'green-light': '#D8F5E3',
  // Purple
  'purple-dark': '#0B0512',
  'purple-light': '#EEDDF5',
  // Mardi Gold (Amber)
  'mardi-gold-dark': '#8D7134',
  'mardi-gold-light': '#F3ECDD',
}

/** Apply status bar based on your theme key */
export async function applyStatusBarTheme(theme: ThemeKey) {
  const color = STATUSBAR_BG[theme] ?? '#000000'

  // keep content below the status bar (no overlap surprises)
  await StatusBar.setOverlaysWebView({ overlay: false })

  // background to match your header/theme
  await StatusBar.setBackgroundColor({ color })

  // icon color chosen from background luminance
  const useLightIcons = isDarkBg(color)
  await StatusBar.setStyle({ style: useLightIcons ? Style.Light : Style.Dark })
}
