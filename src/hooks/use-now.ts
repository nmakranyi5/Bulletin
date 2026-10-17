import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { onClockSync, serverNow } from '../../lib/time';

// The current *server* time (the phone's clock corrected for any drift), refreshed on
// an interval, whenever the app returns to the foreground, and whenever the drift is
// re-measured. Timers keep running while the app is suspended.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const refresh = () => setNow(serverNow());
    const tick = setInterval(refresh, intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const unsubscribeSync = onClockSync(refresh);
    return () => {
      clearInterval(tick);
      sub.remove();
      unsubscribeSync();
    };
  }, [intervalMs]);

  return now;
}
