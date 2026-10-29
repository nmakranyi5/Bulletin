import { Alert } from 'react-native';

import {
  ReplyRequest,
  incomingRequestNotice,
  requestOutcomeNotice,
} from '../../../lib/reply-window';
import { useAnnounceOnce } from '../../hooks/use-announce-once';
import { Match } from '../../types';

// Tells you once when someone asks to change a chat's reply time, and when a request you made is
// accepted, declined or runs out. (The request itself also shows in that chat.)
export function useReplyWindowNotices({
  requests,
  matches,
  loaded,
  userId,
  onOpenChat,
}: {
  requests: ReplyRequest[];
  matches: Match[];
  loaded: boolean;
  userId: string;
  onOpenChat: (matchId: string) => void;
}) {
  const nameOf = (interestId: string) =>
    matches.find((m) => m.id === interestId)?.name.split(' ')[0] ?? 'Someone';

  // Each request is announced once per state it reaches: a new request to you, or the outcome of
  // one you made.
  const items = requests
    .filter((r) => (r.requestedBy === userId ? r.status !== 'pending' : r.status === 'pending'))
    .map((r) => ({
      id: `${r.id}:${r.requestedBy === userId ? r.status : 'incoming'}`,
      request: r,
    }));

  useAnnounceOnce({
    items,
    loaded,
    storageKey: `bulletin.reply-window-seen.${userId}`,
    announce: (fresh, done) => {
      const incoming = fresh.filter((f) => f.request.requestedBy !== userId);
      const outcomes = fresh.filter((f) => f.request.requestedBy === userId);

      if (outcomes.length > 0) {
        const { title, message } = requestOutcomeNotice(
          outcomes.map((o) => ({
            name: nameOf(o.request.interestId),
            hours: o.request.hours,
            status: o.request.status,
          }))
        );
        Alert.alert(title, message, [{ text: 'OK', onPress: done }], {
          cancelable: true,
          onDismiss: done,
        });
        return;
      }

      const first = incoming[0].request;
      const { title, message } = incomingRequestNotice(nameOf(first.interestId), first.hours);
      Alert.alert(
        title,
        message,
        [
          { text: 'Later', style: 'cancel', onPress: done },
          {
            text: 'Open chat',
            onPress: () => {
              done();
              onOpenChat(first.interestId);
            },
          },
        ],
        { cancelable: true, onDismiss: done }
      );
    },
  });
}
