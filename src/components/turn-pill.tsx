import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { Turn } from '../../lib/chat';

// "Your turn" / "Their turn": whose move it is in a chat. Your turn is filled so it stands
// out in a list; their turn is quiet.
export function TurnPill({ turn }: { turn: Turn }) {
  const c = useTheme().colors;
  const local = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          paddingHorizontal: 9,
          paddingVertical: 3,
          borderRadius: 10,
          borderWidth: 1,
        },
        text: { fontSize: 11, fontWeight: '800' },
      }),
    []
  );
  const mine = turn === 'you';

  return (
    <View
      style={[
        local.pill,
        mine
          ? { backgroundColor: c.accent, borderColor: c.accent }
          : { backgroundColor: 'transparent', borderColor: c.border },
      ]}
    >
      <Text style={[local.text, { color: mine ? c.onAccent : c.muted }]}>
        {mine ? 'Your turn' : 'Their turn'}
      </Text>
    </View>
  );
}
