import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

// Calls `announce` once for each item the account hasn't been told about yet. Which items
// were already announced is remembered under `storageKey`; on the very first run nothing
// old is announced. `announce` must call `done()` when its alert is dismissed, and only
// one announcement is shown at a time.
export function useAnnounceOnce<T extends { id: string }>({
  items,
  loaded,
  storageKey,
  announce,
}: {
  items: T[];
  // Whether the list has been fetched at least once ("empty" vs "not loaded yet").
  loaded: boolean;
  storageKey: string;
  announce: (fresh: T[], done: () => void) => void;
}) {
  // null = never run before on this account.
  const seen = useRef<Set<string> | null>(null);
  const [seenReady, setSeenReady] = useState(false);
  const showing = useRef(false);
  const announceRef = useRef(announce);
  announceRef.current = announce;

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled) return;
        try {
          seen.current = raw ? new Set<string>(JSON.parse(raw)) : null;
        } catch {
          seen.current = null;
        }
        setSeenReady(true);
      })
      // If the saved list can't be read, announce nothing this time rather than treating it as
      // a first run (which would mark everything as already seen and overwrite the saved list).
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!loaded || !seenReady) return;

    const persist = () =>
      AsyncStorage.setItem(storageKey, JSON.stringify([...(seen.current ?? [])])).catch(() => {});

    // First run on this account: remember what's already there without announcing it.
    if (seen.current === null) {
      seen.current = new Set(items.map((i) => i.id));
      persist();
      return;
    }

    const fresh = items.filter((i) => !seen.current!.has(i.id));
    if (fresh.length === 0 || showing.current) return;

    fresh.forEach((i) => seen.current!.add(i.id));
    persist();

    showing.current = true;
    announceRef.current(fresh, () => {
      showing.current = false;
    });
  }, [items, loaded, seenReady, storageKey]);
}
