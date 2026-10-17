import { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { CloseReason } from '../../../lib/close-reasons';

import { ConversationMeta, summarizeConversations } from '../../../lib/chat';
import { urgencyOf } from '../../../lib/response-timers';
import { supabase } from '../../../lib/supabase';
import { Match } from '../../types';

// A match is an accepted interest. Also tracks conversation previews and the open chat.
export function useMatches(
  session: Session | null,
  enabled: boolean,
  onClosed: () => void
) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [convoMeta, setConvoMeta] = useState<Record<string, ConversationMeta>>({});
  // Stored as an id and looked up, so an open chat updates when the other person closes it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The chat the user is closing (shows the reason picker).
  const [closingMatch, setClosingMatch] = useState<Match | null>(null);

  const selectedMatch = matches.find((m) => m.id === selectedId) ?? null;
  const setSelectedMatch = (match: Match | null) => setSelectedId(match?.id ?? null);
  const activeMatches = matches.filter((m) => m.status === 'accepted');
  const archivedMatches = matches
    .filter((m) => m.status === 'closed')
    .sort((a, b) => ((a.closed?.at ?? '') < (b.closed?.at ?? '') ? 1 : -1));

  const fetchConversationMeta = async (matchIds: string[]) => {
    if (!session || matchIds.length === 0) {
      setConvoMeta({});
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('interest_id, sender_id, body, created_at, read_at, deleted_at')
      .in('interest_id', matchIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error) setConvoMeta(summarizeConversations(data ?? [], session.user.id));
  };

  const fetchMatches = async (opts?: { silent?: boolean }) => {
    if (!session) return;

    const me = session.user.id;
    const { data, error } = await supabase
      .from('interests')
      .select(
        'id, status, from_user, to_user, closed_reason, closed_note, closed_at, closed_by, from_chat_hidden, to_chat_hidden, from_profile:profiles!from_user(id, name, username, avatar_url), to_profile:profiles!to_user(id, name, username, avatar_url), position:positions(id, title, company, urgency)'
      )
      .in('status', ['accepted', 'closed'])
      .or(`from_user.eq.${me},to_user.eq.${me}`);

    if (error) {
      if (!opts?.silent) Alert.alert('Error', error.message);
      return;
    }

    await fetchConversationMeta((data ?? []).map((row: any) => row.id));

    setMatches(
      (data ?? [])
      // Archived chats you deleted stay out of your list.
      .filter((row: any) => !(row.from_user === me ? row.from_chat_hidden : row.to_chat_hidden))
      .map((row: any) => {
        const other = row.from_user === me ? row.to_profile : row.from_profile;
        return {
          id: row.id,
          status: row.status === 'closed' ? ('closed' as const) : ('accepted' as const),
          closed:
            row.status === 'closed'
              ? {
                  reason: row.closed_reason ?? null,
                  note: row.closed_note ?? null,
                  at: row.closed_at ?? null,
                  byMe: row.closed_by === me,
                }
              : undefined,
          otherUserId: other?.id ?? '',
          positionId: row.position?.id ?? null,
          name: other?.name ?? other?.username ?? 'Unknown',
          position: row.position?.title ?? 'General',
          company: row.position?.company ?? '',
          avatarUrl: other?.avatar_url ?? null,
          urgency: urgencyOf(row.position),
        };
      })
    );
  };

  useEffect(() => {
    if (enabled) fetchMatches();
  }, [session, enabled]);

  // Keep previews and unread counts current on every tab (the Messages badge depends on
  // them), not just while the Messages list is open. Bursts of changes are batched.
  const refetch = useRef(fetchMatches);
  refetch.current = fetchMatches;
  useEffect(() => {
    if (!enabled || !session) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel('messages-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => refetch.current({ silent: true }), 400);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [session, enabled]);

  // Unread messages across your active chats: what the Messages tab badge shows.
  const unreadTotal = activeMatches.reduce((n, m) => n + (convoMeta[m.id]?.unread ?? 0), 0);

  // Closing always carries a reason (and an optional note) for the other person.
  // Returns true on success so the picker knows to close.
  const closeChat = async (reason: CloseReason, note: string | null): Promise<boolean> => {
    if (!closingMatch) return false;

    const { error } = await supabase.rpc('close_chat', {
      p_interest_id: closingMatch.id,
      p_reason: reason,
      p_note: note,
    });

    if (error) {
      Alert.alert('Could not close chat', error.message);
      return false;
    }

    setClosingMatch(null);
    setSelectedId(null);
    fetchMatches();
    onClosed();
    return true;
  };

  // Removes an archived chat from your list only; the other person keeps theirs.
  const deleteArchived = (match: Match) => {
    Alert.alert(
      'Delete this chat?',
      `This removes it from your archive. ${match.name} keeps their copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('hide_archived_chat', {
              p_interest_id: match.id,
            });
            if (error) {
              Alert.alert('Could not delete', error.message);
              return;
            }
            setSelectedId(null);
            setMatches((prev) => prev.filter((m) => m.id !== match.id));
          },
        },
      ]
    );
  };

  return {
    unreadTotal,
    deleteArchived,
    matches,
    activeMatches,
    archivedMatches,
    convoMeta,
    selectedMatch,
    setSelectedMatch,
    fetchMatches,
    closingMatch,
    requestClose: setClosingMatch,
    cancelClose: () => setClosingMatch(null),
    closeChat,
  };
}
