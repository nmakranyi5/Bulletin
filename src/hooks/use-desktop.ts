import { Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_MIN_WIDTH } from '../constants/app';

// True on wide web windows, where navigation becomes a sidebar like a desktop app.
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
