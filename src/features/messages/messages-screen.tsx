import { Archive, Check, CheckCheck, MessageCircle } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { ConversationMeta, formatListTime } from '../../../lib/chat';
import { closeOutcome, isDeal } from '../../../lib/close-reasons';
import { timerStatus } from '../../../lib/response-timers';
import { supabase } from '../../../lib/supabase';
import { Avatar } from '../../components/avatar';
import { RefreshableEmpty } from '../../components/refreshable-empty';
import { TimerChip } from '../../components/timer-chip';
import { useNow } from '../../hooks/use-now';
import { useRefreshControl } from '../../hooks/use-refresh-control';
import { useSharedStyles } from '../../styles/shared';
import { Match } from '../../types';

export function MessagesScreen({
  active,
  archived,
  meta,
  onMatchPress,
  onViewProfile,
  onRefresh,
}: {
  active: Match[];
  archived: Match[];
  meta: Record<string, ConversationMeta>;
  onMatchPress: (match: Match) => void;
  // Tapping the avatar opens the person's full card.
  onViewProfile: (match: Match) => void;
  // Reloads matches and previews; also used for pull-to-refresh (resolves when done).
  onRefresh: () => Promise<unknown> | void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const now = useNow();
  const refreshControl = useRefreshControl(onRefresh);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const isArchive = view === 'archived';
  const matches = isArchive ? archived : active;

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
  // Archived chats are already ordered by when they were closed.
  const sorted = isArchive ? matches : [...matches].sort((a, b) => {
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

      <View style={shared.subTabBar}>
        {(['active', 'archived'] as const).map((v) => {
          const count = v === 'active' ? active.length : archived.length;
          return (
            <Pressable
              key={v}
              style={[shared.subTabItem, view === v && shared.subTabItemActive]}
              onPress={() => setView(v)}
            >
              <Text style={[shared.subTabText, view === v && shared.subTabTextActive]}>
                {v === 'active' ? 'Active' : 'Archived'}
                {count > 0 ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {matches.length === 0 ? (
<RefreshableEmpty refreshControl={refreshControl}>
        <View style={shared.emptyState}>
          {isArchive ? (
            <Archive size={48} color={c.muted} strokeWidth={1.5} />
          ) : (
            <MessageCircle size={48} color={c.muted} strokeWidth={1.5} />
          )}
          <Text style={shared.emptyTitle}>
            {isArchive ? 'Nothing archived.' : 'No messages yet.'}
          </Text>
          <Text style={shared.emptySubtitle}>
            {isArchive
              ? 'Chats you close, and chats closed on you, are kept here.'
              : 'Once you match with someone, your conversation shows up here.'}
          </Text>
        </View>
</RefreshableEmpty>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          refreshControl={refreshControl}
          contentContainerStyle={shared.interestsList}
          renderItem={({ item }) => {
            const m = meta[item.id];
            const unread = m?.unread ?? 0;
            return (
              <Pressable style={shared.interestRow} onPress={() => onMatchPress(item)}>
                <Pressable onPress={() => onViewProfile(item)} hitSlop={6}>
                  <Avatar uri={item.avatarUrl} />
                </Pressable>

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

                  {isArchive && item.closed ? (
                    <View style={local.outcomeRow}>
                      <View style={[local.outcomePill, isDeal(item.closed.reason) && local.outcomeDeal]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            local.outcomeText,
                            isDeal(item.closed.reason) && local.outcomeTextDeal,
                          ]}
                        >
                          {closeOutcome(item.closed.reason)}
                        </Text>
                      </View>
                      <Text style={local.outcomeBy}>
                        {item.closed.byMe ? 'by you' : `by ${item.name.split(' ')[0]}`}
                      </Text>
                    </View>
                  ) : !isArchive && m?.awaitingSince ? (
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
        outcomeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
        },

        outcomePill: {
          flexShrink: 1,
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 10,
          backgroundColor: c.surfaceAlt,
        },

        outcomeDeal: {
          backgroundColor: c.green,
        },

        outcomeText: {
          fontSize: 12,
          fontWeight: '700',
          color: c.textSecondary,
        },

        outcomeTextDeal: {
          color: c.white,
        },

        outcomeBy: {
          fontSize: 12,
          color: c.muted,
        },

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
