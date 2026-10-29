import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemeProvider, useTheme } from '../../lib/app-theme';
import { installWebAlert, WebAlertHost } from '../../lib/web-alert';
import { APP_MAX_WIDTH } from '../constants/app';

// On the web, make Alert.alert show real dialogs (it's a no-op there otherwise).
installWebAlert();

// On wide screens the web shows the app as a phone-sized column in the middle of the page,
// instead of stretching every list, chat and bar across the whole window. Phones are untouched.
function AppFrame({ children }: { children: ReactNode }) {
  const { mode, colors } = useTheme();
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return <>{children}</>;

  const framed = width > APP_MAX_WIDTH;
  return (
    <View style={[frame.outer, { backgroundColor: mode === 'dark' ? '#000000' : '#E4E4E9' }]}>
      <View
        style={[
          frame.inner,
          { backgroundColor: colors.bg },
          framed && {
            borderLeftWidth: StyleSheet.hairlineWidth,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            boxShadow: '0 0 40px rgba(0,0,0,0.12)',
          },
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
