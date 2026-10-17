import { Alert } from 'react-native';

import { EXTEND_OPTIONS, extendedCloseAt } from '../../../lib/close-date';
import { serverNow } from '../../../lib/time';
import { supabase } from '../../../lib/supabase';

type Position = { id: string; title: string; close_at?: string | null };

// Pushes a position's close date back (and reopens it if it already closed).
export async function extendPosition(position: Position, days: number): Promise<boolean> {
  const { error } = await supabase.rpc('extend_position', {
    p_position_id: position.id,
    p_close_at: extendedCloseAt(position.close_at, days, serverNow()),
  });
  if (error) {
    Alert.alert('Could not extend', error.message);
    return false;
  }
  return true;
}

// "Yes, close it on this date." Stops the reminders.
export async function confirmPositionClose(position: Position): Promise<boolean> {
  const { error } = await supabase.rpc('confirm_position_close', { p_position_id: position.id });
  if (error) {
    Alert.alert('Could not confirm', error.message);
    return false;
  }
  return true;
}

// Asks how long to extend by, then does it.
export function promptExtend(position: Position, onDone: () => void) {
  Alert.alert(
    'Extend this position',
    `Keep ${position.title} open for longer. The new date is counted from its current close date.`,
    [
      ...EXTEND_OPTIONS.map((o) => ({
        text: `Add ${o.label}`,
        onPress: async () => {
          if (await extendPosition(position, o.days)) onDone();
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]
  );
}
