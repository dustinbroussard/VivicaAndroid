
import { useState, useEffect, createContext, useContext } from 'react';
import { applyStatusBarTheme } from '@/lib/statusBarService';
import { Storage, DebouncedStorage, STORAGE_KEYS } from '@/utils/storage';

export type ThemeVariant = 'dark' | 'light';
export type ThemeColor =
  | 'default'
  | 'blue'
  | 'red'
  | 'green'
  | 'purple'
  | 'mardi-gold'
  | 'mardi-gras';

// Add a toggleVariant function for compatibility
interface ThemeContextValue {
  color: ThemeColor;
  variant: ThemeVariant;
  setColor: (color: ThemeColor) => void;
  setVariant: (variant: ThemeVariant) => void;
  toggleVariant: () => void;
}

// Remove duplicate interface since we defined it above

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [color, setColor] = useState<ThemeColor>('default');
  const [variant, setVariant] = useState<ThemeVariant>('dark');

  const isValidColor = (c: string): c is ThemeColor =>
    ['default', 'blue', 'red', 'green', 'purple', 'mardi-gold', 'mardi-gras'].includes(c);

  useEffect(() => {
    const saved = Storage.get(STORAGE_KEYS.THEME, { color: 'default' as ThemeColor, variant: 'dark' as ThemeVariant });
    // Migrate legacy theme values eagerly (e.g., ai-choice -> default)
    const migratedColor: ThemeColor = isValidColor(saved.color) ? saved.color : 'default';
    if (saved.color !== migratedColor) {
      Storage.set(STORAGE_KEYS.THEME, { color: migratedColor, variant: saved.variant });
    }
    setColor(migratedColor);
    setVariant(saved.variant as ThemeVariant);

    // Also migrate any profile themeColor values that used legacy labels
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (raw) {
        type ProfileLike = { themeColor?: string } & Record<string, unknown>;
        const profiles: ProfileLike[] = JSON.parse(raw);
        let changed = false;
        const updated = profiles.map((p: ProfileLike) => {
          if (p && p.themeColor === 'ai-choice') {
            changed = true;
            return { ...p, themeColor: 'default' } as ProfileLike;
          }
          return p;
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(updated));
          window.dispatchEvent(new Event('profilesUpdated'));
        }
      }
    } catch (e) {
      // Ignore malformed profiles data; migration is best-effort
      console.debug('Theme migration skipped (profiles parse error)', e);
    }
  }, []);

  useEffect(() => {
    const themeAttr = `${color}-${variant}`;
    document.documentElement.setAttribute('data-theme', themeAttr);
    document.documentElement.classList.toggle('dark', variant === 'dark');
    DebouncedStorage.set(STORAGE_KEYS.THEME, { color, variant }, 300);
  }, [color, variant]);

  useEffect(() => {
    applyStatusBarTheme(variant).catch(() => {});
  }, [color, variant]);

  const toggleVariant = () => {
    setVariant(variant === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider
      value={{ color, variant, setColor, setVariant, toggleVariant }}
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
