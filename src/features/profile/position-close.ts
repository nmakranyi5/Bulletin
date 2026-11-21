import { Alert } from 'react-native';

import { EXTEND_OPTIONS, extendedCloseAt } from '../../../lib/close-date';
import { serverNow } from '../../../lib/time';
import { supabase } from '../../../lib/supabase';
import { t } from '../../../lib/i18n';

type Position = { id: string; title: string; close_at?: string | null };

// Pushes a position's close date back (and reopens it if it already closed).
export async function extendPosition(position: Position, days: number): Promise<boolean> {
  const { error } = await supabase.rpc('extend_position', {
    p_position_id: position.id,
    p_close_at: extendedCloseAt(position.close_at, days, serverNow()),
  });
  if (error) {
    Alert.alert(t('posClose.couldNotExtend'), error.message);
    return false;
  }
  return true;
}

// "Yes, close it on this date." Stops the reminders.
export async function confirmPositionClose(position: Position): Promise<boolean> {
  const { error } = await supabase.rpc('confirm_position_close', { p_position_id: position.id });
  if (error) {
    Alert.alert(t('posClose.couldNotConfirm'), error.message);
    return false;
  }
  return true;
}

// Asks how long to extend by, then does it.
export function promptExtend(position: Position, onDone: () => void) {
  Alert.alert(
    t('posClose.extendTitle'),
    t('posClose.extendBody', { title: position.title }),
    [
      ...EXTEND_OPTIONS.map((o) => ({
        text: t('posClose.add', { label: o.label }),
        onPress: async () => {
          if (await extendPosition(position, o.days)) onDone();
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]
  );
}

// Closes a position now, after asking. People still waiting on it get their interest back;
// chats that already started stay open.
export function promptClose(position: Position, onDone: () => void) {
  Alert.alert(
    t('posClose.closeTitle'),
    t('posClose.closeBody', { title: position.title }),
    [
      { text: t('posClose.keepOpen'), style: 'cancel' },
      {
        text: t('pos.closePosition'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('close_position', { p_position_id: position.id });
          if (error) {
            Alert.alert(t('posClose.couldNotClose'), error.message);
            return;
          }
          onDone();
        },
      },
    ]
  );
}

// Reopens a closed position. One whose date has passed needs a new date, so it goes
// through the extend prompt; otherwise it just opens again.
export async function reopenPosition(
  position: Position,
  now: number,
  onDone: () => void
): Promise<void> {
  const dateHasPassed =
    !!position.close_at && new Date(position.close_at).getTime() <= now;
  if (dateHasPassed) {
    promptExtend(position, onDone);
    return;
  }
  const { error } = await supabase.rpc('reopen_position', { p_position_id: position.id });
  if (error) Alert.alert(t('posClose.couldNotReopen'), error.message);
  else onDone();
}
