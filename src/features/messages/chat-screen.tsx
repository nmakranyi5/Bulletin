import { ArrowLeft, Check, CheckCheck, Send, UserRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatDayLabel, formatTime, isSameDay, MessageStatus } from '../../../lib/chat';
import { supabase } from '../../../lib/supabase';
import { width } from '../../constants/app';
import { useSharedStyles } from '../../styles/shared';
import { Match } from '../../types';

export type ChatMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  createdAt: string;
  readAt: string | null;
  status: MessageStatus;
};

type ChatItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; msg: ChatMessage; groupStart: boolean; showStatus: boolean };

export function ChatScreen({
  match,
  userId,
  onClose,
  onBack,
}: {
  match: Match;
  userId: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const c = useTheme().colors;
  const shared = useSharedStyles();
  const local = useLocalStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatItem>>(null);

  const markRead = () => {
    supabase.rpc('mark_messages_read', { p_interest_id: match.id }).then(() => {});
  };

  useEffect(() => {
    let active = true;
    const toChat = (row: any): ChatMessage => ({
      id: row.id,
      text: row.body,
      fromMe: row.sender_id === userId,
      createdAt: row.created_at,
      readAt: row.read_at ?? null,
      status: row.read_at ? 'read' : 'sent',
    });
    const upsert = (msg: ChatMessage) =>
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id)
          ? prev.map((m) => (m.id === msg.id ? msg : m))
          : [...prev, msg]
      );

    supabase
      .from('messages')
      .select('id, sender_id, body, created_at, read_at')
      .eq('interest_id', match.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
        setMessages((prev) => [
          ...(data ?? []).map(toChat),
          ...prev.filter((m) => m.status === 'sending' || m.status === 'failed'),
        ]);
        markRead();
      });

    const channel = supabase
      .channel(`messages:${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `interest_id=eq.${match.id}`,
        },
        (payload) => {
          const msg = toChat(payload.new);
          upsert(msg);
          // The chat is open, so anything from them is read immediately.
          if (!msg.fromMe) markRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `interest_id=eq.${match.id}`,
        },
        (payload) => upsert(toChat(payload.new))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [match.id, userId]);

  const sendBody = async (body: string, tempId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({ interest_id: match.id, sender_id: userId, body })
      .select('id, sender_id, body, created_at, read_at')
      .single();

    if (error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' as const } : m))
      );
      return;
    }

    setMessages((prev) => {
      const real: ChatMessage = {
        id: data.id,
        text: data.body,
        fromMe: true,
        createdAt: data.created_at,
        readAt: data.read_at ?? null,
        status: data.read_at ? 'read' : 'sent',
      };
      // Realtime may have already delivered the real row.
      return prev.some((m) => m.id === data.id)
        ? prev.filter((m) => m.id !== tempId)
        : prev.map((m) => (m.id === tempId ? real : m));
    });
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) return;

    const tempId = `tmp-${Date.now()}`;
    setDraft('');
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        text: body,
        fromMe: true,
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
      },
    ]);
    sendBody(body, tempId);
  };

  const retry = (msg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' as const } : m))
    );
    sendBody(msg.text, msg.id);
  };

  // Flatten into day separators + grouped bubbles; the status line sits under my latest message.
  const lastMineId = [...messages].reverse().find((m) => m.fromMe)?.id;
  const items: ChatItem[] = [];
  messages.forEach((msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      items.push({ type: 'day', key: `day-${msg.id}`, label: formatDayLabel(msg.createdAt) });
    }
    const groupStart =
      !prev ||
      prev.fromMe !== msg.fromMe ||
      !isSameDay(prev.createdAt, msg.createdAt) ||
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
    items.push({
      type: 'msg',
      key: msg.id,
      msg,
      groupStart,
      showStatus: msg.id === lastMineId,
    });
  });

  const statusLabel = (m: ChatMessage) =>
    m.status === 'sending'
      ? 'Sending...'
      : m.status === 'failed'
      ? 'Not sent. Tap to retry'
      : m.status === 'read' && m.readAt
      ? `Read ${formatTime(m.readAt)}`
      : 'Sent';

  return (
    <KeyboardAvoidingView
      style={local.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={shared.chatHeader}>
        <Pressable onPress={onBack} style={shared.chatBackButton}>
          <ArrowLeft size={22} color={c.text} strokeWidth={2.2} />
        </Pressable>

        <View style={local.chatHeaderAvatar}>
          <UserRound size={22} color={c.textSecondary} strokeWidth={1.8} />
        </View>

        <View style={shared.chatHeaderInfo}>
          <Text numberOfLines={1} style={shared.chatHeaderName}>
            {match.name}
          </Text>
          <Text numberOfLines={1} style={local.chatHeaderMeta}>
            {match.company ? `${match.position} · ${match.company}` : match.position}
          </Text>
        </View>

        <Pressable onPress={onClose} hitSlop={10} style={shared.chatBackButton}>
          <X size={22} color={c.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={local.chatMessages}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          if (item.type === 'day') {
            return (
              <View style={local.chatDayWrap}>
                <Text style={local.chatDayText}>{item.label}</Text>
              </View>
            );
          }

          const { msg, groupStart, showStatus } = item;
          return (
            <View style={[local.chatRow, groupStart && local.chatRowGroupStart]}>
              <Pressable
                disabled={msg.status !== 'failed'}
                onPress={() => retry(msg)}
                style={[
                  local.chatBubble,
                  msg.fromMe ? local.chatBubbleMine : local.chatBubbleTheirs,
                  msg.status === 'sending' && { opacity: 0.6 },
                  msg.status === 'failed' && local.chatBubbleFailed,
                ]}
              >
                <Text style={[local.chatBubbleText, msg.fromMe && local.chatBubbleTextMine]}>
                  {msg.text}
                </Text>
                <View style={local.chatMetaRow}>
                  <Text style={[local.chatTime, msg.fromMe && local.chatTimeMine]}>
                    {formatTime(msg.createdAt)}
                  </Text>
                  {msg.fromMe &&
                    (msg.status === 'read' ? (
                      <CheckCheck size={14} color={c.blueLight} strokeWidth={2.4} />
                    ) : msg.status === 'sent' ? (
                      <Check size={14} color={c.muted} strokeWidth={2.4} />
                    ) : null)}
                </View>
              </Pressable>

              {msg.fromMe && (showStatus || msg.status === 'failed') && (
                <Text
                  style={[local.chatStatus, msg.status === 'failed' && local.chatStatusFailed]}
                >
                  {statusLabel(msg)}
                </Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={local.chatEmptyText}>
            Say hello to {match.name.split(' ')[0]}.
          </Text>
        }
      />

      <View style={local.chatInputRow}>
        <TextInput
          style={local.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
          placeholderTextColor={c.muted}
          multiline
        />

        <Pressable
          style={[local.chatSendButton, !draft.trim() && local.chatSendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim()}
        >
          <Send size={18} color={c.onAccent} strokeWidth={2.4} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        chatContainer: {
          flex: 1,
        },

        chatHeaderMeta: {
          marginTop: 1,
          fontSize: 12,
          color: c.textSecondary,
        },

        chatMessages: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 2,
          flexGrow: 1,
        },

        chatBubble: {
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
        },

        chatBubbleMine: {
          alignSelf: 'flex-end',
          backgroundColor: c.accent,
          borderBottomRightRadius: 4,
        },

        chatBubbleTheirs: {
          alignSelf: 'flex-start',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderBottomLeftRadius: 4,
        },

        chatRow: {
          gap: 3,
        },

        chatRowGroupStart: {
          marginTop: 8,
        },

        chatHeaderAvatar: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        },

        chatDayWrap: {
          alignSelf: 'center',
          marginVertical: 10,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: c.surfaceAlt,
        },

        chatDayText: {
          fontSize: 11,
          fontWeight: '700',
          color: c.textSecondary,
        },

        chatMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-end',
          gap: 4,
          marginTop: 3,
        },

        chatTime: {
          fontSize: 10,
          color: c.muted,
        },

        chatTimeMine: {
          color: c.muted,
        },

        chatBubbleFailed: {
          borderWidth: 1,
          borderColor: c.danger,
        },

        chatStatus: {
          alignSelf: 'flex-end',
          fontSize: 11,
          color: c.textSecondary,
        },

        chatStatusFailed: {
          color: c.danger,
          fontWeight: '600',
        },

        chatBubbleText: {
          fontSize: 15,
          lineHeight: 20,
          color: c.text,
        },

        chatBubbleTextMine: {
          color: c.onAccent,
        },

        chatEmptyText: {
          textAlign: 'center',
          marginTop: 40,
          fontSize: 14,
          color: c.muted,
        },

        chatInputRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: c.border,
          backgroundColor: c.surface,
        },

        chatInput: {
          flex: 1,
          maxHeight: 100,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: c.surfaceAlt,
          fontSize: 15,
          color: c.text,
        },

        chatSendButton: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
        },

        chatSendButtonDisabled: {
          backgroundColor: c.disabled,
        },
      }),
    [c]
  );
}
