import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

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
  // On the web the page is pre-rendered (light) and then hydrated: a first render that differs
  // from it leaves the pre-rendered colours stuck on some elements. So the web starts light
  // and switches to the saved or system theme right after mounting.
  const [mode, setModeState] = useState<ThemeMode>(
    Platform.OS !== 'web' && system === 'dark' ? 'dark' : 'light'
  );

  // Restore the saved choice; with none saved, keep following the system.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
          syncNativeScheme(saved);
        } else if (Platform.OS === 'web' && system === 'dark') {
          setModeState('dark');
        }
      })
      .catch(() => {});
  }, []);

  // On the web, theme the page itself too: the area around the app (and the browser's own
  // toolbar tint on phones) follows the page background, which otherwise stays light.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = mode === 'dark' ? dark.bg : light.bg;
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = mode;
    document.body.style.backgroundColor = bg;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
  }, [mode]);

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
