
import {
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Storage, DebouncedStorage, STORAGE_KEYS } from '@/utils/storage';
import { useDynamicTheme } from '@/hooks/useDynamicTheme';

const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round((l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
};

export type ThemeVariant = 'dark' | 'light';
export type ThemeColor =
  | 'default'
  | 'blue'
  | 'red'
  | 'green'
  | 'purple'
  | 'mardi-gold'
  | 'ai-choice';

// Add a toggleVariant function for compatibility
interface ThemeContextValue {
  color: ThemeColor;
  variant: ThemeVariant;
  currentMood: string;
  setColor: (color: ThemeColor) => void;
  setVariant: (variant: ThemeVariant) => void;
  setMood: (mood: string) => void;
  toggleVariant: () => void;
}

// Remove duplicate interface since we defined it above

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [color, setColor] = useState<ThemeColor>('default');
  const [variant, setVariant] = useState<ThemeVariant>('dark');
  const [currentMood, setMood] = useState<string>('serene');

  useEffect(() => {
    const saved = Storage.get(STORAGE_KEYS.THEME, { color: 'default' as ThemeColor, variant: 'dark' as ThemeVariant });
    setColor(saved.color as ThemeColor);
    setVariant(saved.variant as ThemeVariant);
  }, []);

  useEffect(() => {
    const themeAttr = `${color === 'ai-choice' ? 'default' : color}-${variant}`;
    document.documentElement.setAttribute('data-theme', themeAttr);
    document.documentElement.classList.toggle('dark', variant === 'dark');
    DebouncedStorage.set(STORAGE_KEYS.THEME, { color, variant }, 300);
  }, [color, variant]);

  useEffect(() => {
    const applyStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const rootStyles = getComputedStyle(document.documentElement);
        const hsl = rootStyles.getPropertyValue('--background').trim();
        let hex = variant === 'dark' ? '#000000' : '#ffffff';
        if (hsl) {
          const parts = hsl.split(/\s+/).map(v => parseFloat(v.replace('%', '')));
          if (parts.length === 3 && parts.every(n => !isNaN(n))) {
            hex = hslToHex(parts[0], parts[1], parts[2]);
          }
        }
        await StatusBar.setBackgroundColor({ color: hex });
        await StatusBar.setStyle({ style: variant === 'dark' ? Style.Light : Style.Dark });
      } catch {
        // Ignore errors when StatusBar plugin is unavailable
      }
    };
    applyStatusBar();
  }, [color, variant, currentMood]);

  useDynamicTheme(currentMood, variant, color === 'ai-choice');

  const toggleVariant = () => {
    setVariant(variant === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{ color, variant, currentMood, setColor, setVariant, setMood, toggleVariant }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
