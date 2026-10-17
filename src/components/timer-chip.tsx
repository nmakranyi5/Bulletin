import { Clock } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { TimerStatus, timerLabel } from '../../lib/response-timers';

// Small countdown pill: neutral while there's time, amber in the last quarter of the
// window, red once the reply is overdue.
export function TimerChip({
  status,
  side,
  prefix,
}: {
  status: TimerStatus;
  side: 'responder' | 'waiting';
  prefix?: string;
}) {
  const c = useTheme().colors;
  const local = useLocalStyles();
  const tone =
    status.state === 'overdue' ? c.danger : status.state === 'soon' ? c.amber : c.textSecondary;

  return (
    <View style={[local.chip, { borderColor: status.state === 'ok' ? c.border : tone }]}>
      <Clock size={12} color={tone} strokeWidth={2.4} />
      <Text numberOfLines={1} style={[local.text, { color: tone }]}>
        {prefix ? `${prefix} · ` : ''}
        {timerLabel(status, side)}
      </Text>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 5,
          marginTop: 6,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          backgroundColor: c.surfaceAlt,
        },

        text: {
          fontSize: 12,
          fontWeight: '600',
          flexShrink: 1,
        },
      }),
    [c]
  );
}
