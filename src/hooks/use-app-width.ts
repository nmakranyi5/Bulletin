import { useWindowDimensions } from 'react-native';
import { APP_MAX_WIDTH } from '../constants/app';

// The width the app actually has to work with: the window, up to the phone-sized column
// it's shown in on wide screens.
export function useAppWidth(): number {
  return Math.min(useWindowDimensions().width, APP_MAX_WIDTH);
}
