import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { declineNotice } from '../../../lib/decline-reasons';
import { InterestRow } from '../../types';

// Tells you once when an interest you sent is declined, with the reason, so it can't go
// unnoticed in a list. Which declines you've already been told about is remembered per
// account; on the very first run nothing old is announced.
export function useDeclineNotices({
  sentInterests,
  loaded,
  userId,
  onView,
}: {
  sentInterests: InterestRow[];
  // Whether the sent list has been fetched at least once ("empty" vs "not loaded yet").
  loaded: boolean;
  userId: string;
  onView: () => void;
}) {
  const storageKey = `bulletin.declines-seen.${userId}`;
  // null = never run before on this account.
  const seen = useRef<Set<string> | null>(null);
  const [seenReady, setSeenReady] = useState(false);
  const showing = useRef(false);
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

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
      .catch(() => {
        if (cancelled) return;
        seen.current = null;
        setSeenReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!loaded || !seenReady) return;

    const persist = () =>
      AsyncStorage.setItem(storageKey, JSON.stringify([...(seen.current ?? [])])).catch(() => {});
    const declined = sentInterests.filter((i) => i.status === 'rejected');

    // First run on this account: remember what's already there without announcing it.
    if (seen.current === null) {
      seen.current = new Set(declined.map((i) => i.id));
      persist();
      return;
    }

    const fresh = declined.filter((i) => !seen.current!.has(i.id));
    if (fresh.length === 0 || showing.current) return;

    fresh.forEach((i) => seen.current!.add(i.id));
    persist();

    showing.current = true;
    const done = () => {
      showing.current = false;
    };
    const { title, message } = declineNotice(
      fresh.map((i) => ({
        name: i.to_profile?.name ?? 'Someone',
        position: i.position?.title,
        reason: i.decline_reason,
        note: i.decline_note,
      }))
    );

    Alert.alert(
      title,
      message,
      [
        { text: 'OK', style: 'cancel', onPress: done },
        {
          text: 'View',
          onPress: () => {
            done();
            onViewRef.current();
          },
        },
      ],
      { cancelable: true, onDismiss: done }
    );
  }, [sentInterests, loaded, seenReady, storageKey]);
}
