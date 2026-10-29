import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

// On the web the page background matches the app's all the way across, so it reads as one page.
// (Pages that should stay a comfortable width use PageColumn; the signed-in app on wide
// screens lays itself out with a sidebar.)
function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[frame.outer, { backgroundColor: colors.bg }]}>{children}</View>;
}

const frame = StyleSheet.create({
  outer: { flex: 1 },
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
