import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

function ThemedStack() {
  const { mode, colors } = useTheme();

  return (
    <>
      <Head>
        <title>bulletin.</title>
      </Head>
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
      <ThemedStack />
    </ThemeProvider>
  );
}
