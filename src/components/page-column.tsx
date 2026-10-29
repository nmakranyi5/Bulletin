import { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { APP_MAX_WIDTH } from '../constants/app';

// Keeps a full-screen page (login, setup, forms...) to a comfortable width in the middle of
// a wide web window instead of stretching it. On phones it does nothing.
export function PageColumn({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH },
});
