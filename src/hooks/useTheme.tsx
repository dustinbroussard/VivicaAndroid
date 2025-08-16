import {
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import { applyStatusBarTheme, ThemeKey, ThemeFamily } from '@/lib/statusBar';
import { Storage, DebouncedStorage, STORAGE_KEYS } from '@/utils/storage';
import { useDynamicTheme } from '@/hooks/useDynamicTheme';

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
    const mapThemeFamily = (c: ThemeColor): ThemeFamily => {
      switch (c) {
        case 'blue':
        case 'red':
        case 'green':
        case 'purple':
          return c;
        default:
          return 'default';
      }
    };
    const themeKey = `${mapThemeFamily(color)}-${variant}` as ThemeKey;
    applyStatusBarTheme(themeKey).catch(() => {});
  }, [color, variant]);

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
