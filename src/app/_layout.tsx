import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';
import { APP_MAX_WIDTH } from '../constants/app';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

// On wide screens the web keeps the app's content in a centred column instead of stretching
// every list and chat across the whole window. Phones are untouched.
function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;

  // Same background all the way across, with no border or shadow, so it reads as one page
  // with a centred column of content rather than a screen sitting on another screen.
  return (
    <View style={[frame.outer, { backgroundColor: colors.bg }]}>
      <View style={[frame.inner, { backgroundColor: colors.bg }]}>{children}</View>
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
