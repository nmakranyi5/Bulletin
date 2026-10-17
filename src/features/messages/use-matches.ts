import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

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
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

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
        'id, from_user, to_user, from_profile:profiles!from_user(id, name, username, avatar_url), to_profile:profiles!to_user(id, name, username, avatar_url), position:positions(id, title, company, urgency)'
      )
      .eq('status', 'accepted')
      .or(`from_user.eq.${me},to_user.eq.${me}`);

    if (error) {
      if (!opts?.silent) Alert.alert('Error', error.message);
      return;
    }

    fetchConversationMeta((data ?? []).map((row: any) => row.id));

    setMatches(
      (data ?? []).map((row: any) => {
        const other = row.from_user === me ? row.to_profile : row.from_profile;
        return {
          id: row.id,
          otherUserId: other?.id ?? '',
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

  const closeMatch = (match: Match) => {
    Alert.alert(
      'Close chat?',
      `This ends your conversation with ${match.name} for both of you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close chat',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('interests')
              .update({ status: 'closed' })
              .eq('id', match.id)
              .eq('status', 'accepted')
              .select('id');

            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            if (!data || data.length === 0) {
              Alert.alert('Could not close', 'Something went wrong closing this chat.');
              return;
            }

            setSelectedMatch(null);
            fetchMatches();
            onClosed();
          },
        },
      ]
    );
  };

  return { matches, convoMeta, selectedMatch, setSelectedMatch, fetchMatches, closeMatch };
}
