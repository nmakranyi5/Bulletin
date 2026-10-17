import { useEffect, useMemo, useRef } from 'react';
import { Alert, AppState } from 'react-native';

import { ConversationMeta } from '../../../lib/chat';
import {
  alertCopy,
  newlyOverdue,
  PendingReply,
  timerStatus,
  urgencyOf,
} from '../../../lib/response-timers';
import { syncServerClock } from '../../../lib/time';
import { supabase } from '../../../lib/supabase';
import { useNow } from '../../hooks/use-now';
import { InterestRow, Match } from '../../types';

const REFRESH_MS = 60_000;
// Re-measure the clock gap every N refreshes (every 5 minutes).
const CLOCK_SYNC_EVERY = 5;

// Watches everything waiting on *your* reply (new interests and unanswered chat
// messages), keeps it fresh, and raises an alert when a reply's time limit is reached.
// It never closes or blocks anything.
export function useResponseTimers({
  receivedInterests,
  matches,
  convoMeta,
  openChatId,
  refresh,
  onOpenInterests,
  onOpenChat,
}: {
  receivedInterests: InterestRow[];
  matches: Match[];
  convoMeta: Record<string, ConversationMeta>;
  // The chat on screen right now; you're already reading it, so no alert for it.
  openChatId: string | null;
  refresh: () => void;
  onOpenInterests: () => void;
  onOpenChat: (matchId: string) => void;
}) {
  const now = useNow();

  const items = useMemo(() => {
    const list: PendingReply[] = [];
    for (const r of receivedInterests) {
      if (!r.created_at) continue;
      list.push({
        key: `interest:${r.id}:${r.created_at}`,
        kind: 'interest',
        id: r.id,
        name: r.from_profile?.name ?? 'Someone',
        urgency: urgencyOf(r.position),
        since: r.created_at,
      });
    }
    for (const m of matches) {
      const since = convoMeta[m.id]?.awaitingSince;
      if (!since) continue;
      list.push({
        key: `chat:${m.id}:${since}`,
        kind: 'chat',
        id: m.id,
        name: m.name,
        urgency: m.urgency,
        since,
      });
    }
    return list;
  }, [receivedInterests, matches, convoMeta]);

  // Keep data current so timers start and stop on time even when the relevant tab
  // isn't open: poll once a minute and whenever the app comes back to the foreground.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    // Deadlines are server timestamps, so measure how far this phone's clock is from the
    // server's (wrong clock, different time zone settings, etc.) and correct for it. If
    // the server can't be reached, the previous correction (or none) stays in place.
    const syncClock = () =>
      syncServerClock(async () => {
        const { data, error } = await supabase.rpc('server_time');
        return error ? null : (data as string | null);
      });
    syncClock();

    let polls = 0;
    const poll = setInterval(() => {
      refreshRef.current();
      if (++polls % CLOCK_SYNC_EVERY === 0) syncClock();
    }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refreshRef.current();
        syncClock();
      }
    });
    return () => {
      clearInterval(poll);
      sub.remove();
    };
  }, []);

  // Alert once per unanswered reply when its limit is reached.
  const alerted = useRef(new Set<string>());
  const showing = useRef(false);
  const openRef = useRef({ onOpenInterests, onOpenChat });
  openRef.current = { onOpenInterests, onOpenChat };

  useEffect(() => {
    if (showing.current) return;

    const candidates = items.filter((i) => !(i.kind === 'chat' && i.id === openChatId));
    const due = newlyOverdue(candidates, alerted.current, now);
    if (due.length === 0) return;

    due.forEach((d) => alerted.current.add(d.key));
    showing.current = true;
    const done = () => {
      showing.current = false;
    };
    const first = due[0];
    const { title, message } = alertCopy(due, now);

    Alert.alert(
      title,
      message,
      [
        { text: 'Later', style: 'cancel', onPress: done },
        {
          text: due.length > 1 ? 'View' : first.kind === 'chat' ? 'Open chat' : 'View interest',
          onPress: () => {
            done();
            if (first.kind === 'chat') openRef.current.onOpenChat(first.id);
            else openRef.current.onOpenInterests();
          },
        },
      ],
      { cancelable: true, onDismiss: done }
    );
  }, [items, now, openChatId]);

  // Number of chats where you owe an overdue reply (for the Messages tab badge).
  const overdueChatCount = useMemo(
    () =>
      items.filter((i) => i.kind === 'chat' && timerStatus(i.since, i.urgency, now).state === 'overdue')
        .length,
    [items, now]
  );

  return { items, overdueChatCount };
}
