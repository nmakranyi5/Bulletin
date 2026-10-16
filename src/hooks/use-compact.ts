import { useWindowDimensions } from 'react-native';
import { COMPACT_HEIGHT } from '../constants/app';

// True on short screens (e.g. iPhone SE), where cards drop the big hero image.
export function useIsCompact() {
  return useWindowDimensions().height < COMPACT_HEIGHT;
}
