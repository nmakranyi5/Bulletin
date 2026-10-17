import { Alert } from 'react-native';

import { closedNotice } from '../../../lib/close-date';
import { useAnnounceOnce } from '../../hooks/use-announce-once';
import { InterestRow } from '../../types';

// Tells you once when a position you were waiting on closes. The interest is returned
// to you automatically; any chat that already started stays open.
export function useClosedPositionNotices({
  sentInterests,
  loaded,
  userId,
}: {
  sentInterests: InterestRow[];
  loaded: boolean;
  userId: string;
}) {
  useAnnounceOnce({
    items: sentInterests.filter((i) => i.status === 'position_closed'),
    loaded,
    storageKey: `bulletin.position-closed-seen.${userId}`,
    announce: (fresh, done) => {
      const { title, message } = closedNotice(
        fresh.map((i) => ({
          name: i.to_profile?.name ?? 'the company',
          position: i.position?.title,
        }))
      );

      // Nothing to open: the interest is already gone from your list.
      Alert.alert(title, message, [{ text: 'OK', onPress: done }], {
        cancelable: true,
        onDismiss: done,
      });
    },
  });
}
