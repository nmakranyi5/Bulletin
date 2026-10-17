import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useTheme } from '../../lib/app-theme';

// Even if the data comes back instantly, keep the spinner up long enough to be seen,
// so a pull always feels like it did something.
const MIN_SPINNER_MS = 500;

// Pull-to-refresh for a scrollable screen.
//
//   const refreshControl = useRefreshControl(reloadMyData);
//   <FlatList refreshControl={refreshControl} ... />
//
// `refresh` should return a promise that settles when the data has reloaded; the spinner
// runs until then. Pulling again while a refresh is running does nothing. On the web
// (where there is no pull gesture) the control is an inert wrapper.
export function useRefreshControl(refresh: () => Promise<unknown> | void) {
  const c = useTheme().colors;
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        Promise.resolve(refreshRef.current()),
        new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS)),
      ]);
    } catch {
      // The reload functions report their own errors; the spinner must still stop.
    } finally {
      busy.current = false;
      if (alive.current) setRefreshing(false);
    }
  }, []);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      // iOS spinner colour; Android spinner and its background.
      tintColor={c.textSecondary}
      colors={[c.accent]}
      progressBackgroundColor={c.surface}
    />
  );
}
