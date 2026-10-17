import { Session } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { closeState, reminderCopy } from '../../../lib/close-date';
import { serverNow } from '../../../lib/time';
import { supabase } from '../../../lib/supabase';
import { confirmPositionClose, promptExtend } from './position-close';

const CHECK_MS = 60_000;

// Reminds a recruiter, as a position's close date approaches, to extend it or confirm that
// it should close. Each position is raised once per app session (and stops for good once
// confirmed); "Later" brings it back next time the app opens.
export function usePositionReminders({
  session,
  enabled,
  onOpenPositions,
}: {
  session: Session;
  enabled: boolean;
  onOpenPositions: () => void;
}) {
  const raised = useRef(new Set<string>());
  const showing = useRef(false);
  const onOpenRef = useRef(onOpenPositions);
  onOpenRef.current = onOpenPositions;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const check = async () => {
      if (showing.current) return;
      await supabase.rpc('close_expired_positions');
      const { data, error } = await supabase
        .from('positions')
        .select('id, title, active, close_at, closed_at, close_confirmed_at')
        .eq('recruiter_id', session.user.id)
        .eq('active', true)
        .not('close_at', 'is', null);
      if (!alive || error || showing.current) return;

      const now = serverNow();
      const due = (data ?? [])
        .filter((p) => closeState(p, now).kind === 'soon')
        .filter((p) => !raised.current.has(`${p.id}:${p.close_at}`));
      if (due.length === 0) return;

      due.forEach((p) => raised.current.add(`${p.id}:${p.close_at}`));
      showing.current = true;
      const done = () => {
        showing.current = false;
      };
      const { title, message } = reminderCopy(
        due.map((p) => ({
          title: p.title,
          msLeft: new Date(p.close_at).getTime() - now,
        }))
      );

      if (due.length === 1) {
        const [p] = due;
        Alert.alert(
          title,
          message,
          [
            { text: 'Later', style: 'cancel', onPress: done },
            {
              text: 'Confirm closing',
              onPress: async () => {
                done();
                await confirmPositionClose(p);
              },
            },
            {
              text: 'Extend',
              onPress: () => {
                done();
                promptExtend(p, () => {});
              },
            },
          ],
          { cancelable: true, onDismiss: done }
        );
      } else {
        Alert.alert(
          title,
          message,
          [
            { text: 'Later', style: 'cancel', onPress: done },
            {
              text: 'Open positions',
              onPress: () => {
                done();
                onOpenRef.current();
              },
            },
          ],
          { cancelable: true, onDismiss: done }
        );
      }
    };

    check();
    const tick = setInterval(check, CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      clearInterval(tick);
      sub.remove();
    };
  }, [enabled, session.user.id]);
}
