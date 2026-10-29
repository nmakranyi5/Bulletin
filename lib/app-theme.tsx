import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export type Colors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textStrong: string;
  textSecondary: string;
  muted: string;
  accent: string; // filled buttons, own chat bubbles, active chips
  onAccent: string; // text/icons sitting on `accent`
  disabled: string;
  white: string; // always white, for text on fixed-colour fills (badges)
  danger: string;
  blue: string;
  blueLight: string;
  green: string;
  amber: string;
};

const light: Colors = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4F5',
  border: '#E7E7EA',
  borderStrong: '#D4D4D8',
  text: '#18181B',
  textStrong: '#52525B',
  textSecondary: '#71717A',
  muted: '#A1A1AA',
  accent: '#18181B',
  onAccent: '#FFFFFF',
  disabled: '#D4D4D8',
  white: '#FFFFFF',
  danger: '#EF4444',
  blue: '#2563EB',
  blueLight: '#60A5FA',
  green: '#22C55E',
  amber: '#B45309',
};

const dark: Colors = {
  bg: '#09090B',
  surface: '#18181B',
  surfaceAlt: '#27272A',
  border: '#3F3F46',
  borderStrong: '#52525B',
  text: '#FAFAFA',
  textStrong: '#D4D4D8',
  textSecondary: '#A1A1AA',
  muted: '#71717A',
  accent: '#FAFAFA',
  onAccent: '#18181B',
  disabled: '#3F3F46',
  white: '#FFFFFF',
  danger: '#F87171',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  green: '#22C55E',
  amber: '#FBBF24',
};

const STORAGE_KEY = 'bulletin.theme';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: light,
  setMode: () => {},
});

// Keeps native UI (alerts, keyboard, status bar) in step with the app. React Native for the web
// doesn't have this, so there it's skipped (the web page is themed by the app itself).
function syncNativeScheme(mode: ThemeMode) {
  if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === 'dark' ? 'dark' : 'light');

  // Restore the saved choice; with none saved, keep following the system.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
          syncNativeScheme(saved);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? dark : light,
      setMode: (next) => {
        setModeState(next);
        // Keeps native UI (alerts, keyboard, status bar) in step with the app.
        syncNativeScheme(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
