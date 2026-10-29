import { Platform, useWindowDimensions } from 'react-native';

// Below this window width the web uses the phone layout (bottom tab bar); above it, a sidebar.
export const WIDE_BREAKPOINT = 900;

export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_BREAKPOINT;
}
