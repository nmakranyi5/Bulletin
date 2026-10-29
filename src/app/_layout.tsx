import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';
import { APP_MAX_WIDTH } from '../constants/app';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

// On wide screens the web keeps the app's content in a centred column instead of stretching
// every list and chat across the whole window. Phones are untouched.
function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // The page is pre-rendered without knowing the window size or theme, and the browser keeps
  // that pre-rendered styling when the app starts. So the column's side lines are only added
  // after the first render, as a normal update.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The page itself gets the app's background. (Painted on the document rather than on a view:
  // the page is pre-rendered in the light theme, and the browser keeps that pre-rendered style
  // on a view when the app starts in dark mode.)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
  }, [colors.bg]);

  if (Platform.OS !== 'web') return <>{children}</>;

  // The column is marked out only by thin side lines in the same color as the cards' outlines,
  // so it reads as one page with a centred column of content, not a screen on top of a screen.
  const framed = mounted && width > APP_MAX_WIDTH;
  return (
    <View style={frame.outer}>
      <View
        style={[
          frame.inner,
          framed && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const frame = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH },
});

function ThemedStack() {
  const { mode, colors } = useTheme();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AppFrame>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </AppFrame>
      <WebAlertHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}
