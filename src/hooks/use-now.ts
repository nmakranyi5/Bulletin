import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// The current time, refreshed on an interval and whenever the app returns to the
// foreground (timers keep running while the app is suspended).
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [intervalMs]);

  return now;
}
