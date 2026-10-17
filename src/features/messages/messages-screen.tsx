import { Check, CheckCheck, MessageCircle, UserRound } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { ConversationMeta, formatListTime } from '../../../lib/chat';
import { timerStatus } from '../../../lib/response-timers';
import { supabase } from '../../../lib/supabase';
import { TimerChip } from '../../components/timer-chip';
import { useNow } from '../../hooks/use-now';
import { useSharedStyles } from '../../styles/shared';
import { Match } from '../../types';

export function MessagesScreen({
  matches,
  meta,
  onMatchPress,
  onRefresh,
}: {
  matches: Match[];
  meta: Record<string, ConversationMeta>;
  onMatchPress: (match: Match) => void;
  onRefresh: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const now = useNow();

  useEffect(() => {
    onRefresh();

    // Keep previews and unread counts live while the list is open.
    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () =>
        onRefresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Conversations with messages first (newest on top), then new matches.
  const sorted = [...matches].sort((a, b) => {
    const at = meta[a.id]?.lastAt ?? '';
    const bt = meta[b.id]?.lastAt ?? '';
    return at < bt ? 1 : at > bt ? -1 : 0;
  });

  return (
    <View style={shared.simpleScreen}>
      <View style={shared.screenHeader}>
        <Text style={shared.screenTitle}>bulletin.</Text>
        <Text style={shared.subtitle}>Real conversations. No BS.</Text>
      </View>

      {matches.length === 0 ? (
        <View style={shared.emptyState}>
          <MessageCircle size={48} color={c.muted} strokeWidth={1.5} />
          <Text style={shared.emptyTitle}>No messages yet.</Text>
          <Text style={shared.emptySubtitle}>
            Once you match with someone, your conversation shows up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={shared.interestsList}
          renderItem={({ item }) => {
            const m = meta[item.id];
            const unread = m?.unread ?? 0;
            return (
              <Pressable style={shared.interestRow} onPress={() => onMatchPress(item)}>
                <UserRound size={40} color={c.muted} strokeWidth={1.5} />

                <View style={shared.interestRowInfo}>
                  <View style={local.convoTopRow}>
                    <Text
                      numberOfLines={1}
                      style={[shared.interestRowName, local.convoName]}
                    >
                      {item.name}
                    </Text>
                    {m && (
                      <Text style={[local.convoTime, unread > 0 && local.convoTimeUnread]}>
                        {formatListTime(m.lastAt)}
                      </Text>
                    )}
                  </View>

                  <View style={local.convoBottomRow}>
                    {m?.lastFromMe &&
                      (m.lastRead ? (
                        <CheckCheck size={14} color={c.blue} strokeWidth={2.4} />
                      ) : (
                        <Check size={14} color={c.muted} strokeWidth={2.4} />
                      ))}
                    <Text
                      numberOfLines={1}
                      style={[
                        shared.interestRowMeta,
                        local.convoPreview,
                        unread > 0 && local.convoPreviewUnread,
                      ]}
                    >
                      {m
                        ? `${m.lastFromMe ? 'You: ' : ''}${m.lastText}`
                        : item.company
                        ? `${item.position} · ${item.company}`
                        : item.position}
                    </Text>
                    {unread > 0 && (
                      <View style={local.unreadPill}>
                        <Text style={local.unreadPillText}>{unread > 99 ? '99+' : unread}</Text>
                      </View>
                    )}
                  </View>

                  {m?.awaitingSince ? (
                    <TimerChip
                      side="responder"
                      status={timerStatus(m.awaitingSince, item.urgency, now)}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        convoTopRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },

        convoName: {
          flex: 1,
        },

        convoTime: {
          fontSize: 12,
          color: c.muted,
        },

        convoTimeUnread: {
          color: c.blue,
          fontWeight: '700',
        },

        convoBottomRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        },

        convoPreview: {
          flex: 1,
          marginTop: 0,
        },

        convoPreviewUnread: {
          color: c.text,
          fontWeight: '700',
        },

        unreadPill: {
          minWidth: 20,
          height: 20,
          paddingHorizontal: 6,
          borderRadius: 10,
          backgroundColor: c.blue,
          alignItems: 'center',
          justifyContent: 'center',
        },

        unreadPillText: {
          fontSize: 11,
          fontWeight: '800',
          color: c.white,
        },
      }),
    [c]
  );
}
