import { Clock } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { ReplyRequest, formatHours } from '../../../lib/reply-window';

// The chat's agreed reply time, with a way to ask for a change. If a change has been asked for, it
// shows that instead: Accept / Decline for the person who was asked, a note for the person who asked.
export function ReplyWindowBar({
  hours,
  name,
  request,
  userId,
  onChange,
  onRespond,
}: {
  hours: number;
  name: string;
  request?: ReplyRequest;
  userId: string;
  onChange: () => void;
  onRespond: (accept: boolean) => void;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const first = name.split(' ')[0];

  if (request?.status === 'pending') {
    const mine = request.requestedBy === userId;
    return (
      <View style={local.bar}>
        <Clock size={14} color={c.amber} strokeWidth={2.4} />
        <Text style={local.text}>
          {mine
            ? `Waiting for ${first} to answer your request for ${formatHours(request.hours)}`
            : `${first} asks to change the reply time to ${formatHours(request.hours)}`}
        </Text>
        {!mine && (
          <View style={local.actions}>
            <Pressable style={local.decline} onPress={() => onRespond(false)}>
              <Text style={local.declineText}>Decline</Text>
            </Pressable>
            <Pressable style={local.accept} onPress={() => onRespond(true)}>
              <Text style={local.acceptText}>Accept</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={local.bar}>
      <Clock size={14} color={c.textSecondary} strokeWidth={2.4} />
      <Text style={local.text}>Reply time: {formatHours(hours)}</Text>
      <Pressable onPress={onChange} hitSlop={8}>
        <Text style={local.change}>Change</Text>
      </Pressable>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        bar: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        },

        text: {
          flexShrink: 1,
          fontSize: 12,
          fontWeight: '600',
          color: c.textSecondary,
        },

        change: {
          fontSize: 12,
          fontWeight: '700',
          color: c.blue,
        },

        actions: {
          flexDirection: 'row',
          gap: 8,
          marginLeft: 'auto',
        },

        decline: {
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.borderStrong,
        },

        declineText: {
          fontSize: 12,
          fontWeight: '700',
          color: c.text,
        },

        accept: {
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 10,
          backgroundColor: c.accent,
        },

        acceptText: {
          fontSize: 12,
          fontWeight: '700',
          color: c.onAccent,
        },
      }),
    [c]
  );
}
