import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { I18nProvider } from '../../lib/i18n';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

function ThemedStack() {
  const { mode, colors } = useTheme();

  return (
    <>
      {/* Web only: on iOS/Android Head needs a handoff origin and throws without one. */}
      {Platform.OS === 'web' && (
        <Head>
          <title>bulletin.</title>
        </Head>
      )}
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
      <WebAlertHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ThemedStack />
      </I18nProvider>
    </ThemeProvider>
  );
}
