
import {
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import { Storage, DebouncedStorage, STORAGE_KEYS } from '@/utils/storage';

export type ThemeVariant = 'dark' | 'light';
export type ThemeColor = 'default' | 'blue' | 'red' | 'green' | 'purple';

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

  useEffect(() => {
    const saved = Storage.get(STORAGE_KEYS.THEME, { color: 'default' as ThemeColor, variant: 'dark' as ThemeVariant });
    setColor(saved.color as ThemeColor);
    setVariant(saved.variant as ThemeVariant);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', `${color}-${variant}`);
    document.documentElement.classList.toggle('dark', variant === 'dark');
    
    // Set status bar colors based on theme
    const themeColor = variant === 'dark' ? '#0a0a0a' : '#ffffff';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
    
    DebouncedStorage.set(STORAGE_KEYS.THEME, { color, variant }, 300);
  }, [color, variant]);

  const toggleVariant = () => {
    setVariant(variant === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ color, variant, setColor, setVariant, toggleVariant }}>
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
