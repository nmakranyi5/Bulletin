import { Alert } from 'react-native';

import { declineNotice } from '../../../lib/decline-reasons';
import { useAnnounceOnce } from '../../hooks/use-announce-once';
import { InterestRow } from '../../types';
import { t } from '../../../lib/i18n';

// Tells you once when an interest you sent is declined, with the reason, so it can't go
// unnoticed in a list.
export function useDeclineNotices({
  sentInterests,
  loaded,
  userId,
  onView,
}: {
  sentInterests: InterestRow[];
  loaded: boolean;
  userId: string;
  onView: () => void;
}) {
  useAnnounceOnce({
    items: sentInterests.filter((i) => i.status === 'rejected'),
    loaded,
    storageKey: `bulletin.declines-seen.${userId}`,
    announce: (fresh, done) => {
      const { title, message } = declineNotice(
        fresh.map((i) => ({
          name: i.to_profile?.name ?? t('interests.someone'),
          position: i.position?.title,
          reason: i.decline_reason,
          note: i.decline_note,
        }))
      );

      Alert.alert(
        title,
        message,
        [
          { text: t('common.ok'), style: 'cancel', onPress: done },
          {
            text: t('interests.notice.view'),
            onPress: () => {
              done();
              onView();
            },
          },
        ],
        { cancelable: true, onDismiss: done }
      );
    },
  });
}
