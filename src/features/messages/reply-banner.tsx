import { Clock } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../lib/app-theme';
import { formatDuration, TimerStatus, Urgency, URGENCY } from '../../../lib/response-timers';
import { useT } from '../../../lib/i18n';

// Shown under the chat header while a reply is outstanding. If you owe the reply it
// always shows the countdown; if you're waiting on them it only appears once they're
// overdue (no point nagging about someone who's still within their window).
export function ReplyBanner({
  side,
  status,
  name,
  windowLabel,
  firstMove = false,
}: {
  side: 'responder' | 'waiting';
  status: TimerStatus;
  name: string;
  // The reply time in force, e.g. "3 days".
  windowLabel: string;
  // Nobody has written yet: it's about saying hello, not answering a message.
  firstMove?: boolean;
}) {
  const c = useTheme().colors;
  const t = useT();
  const local = useLocalStyles();

  if (side === 'waiting' && status.state !== 'overdue') return null;

  const tone =
    status.state === 'overdue' ? c.danger : status.state === 'soon' ? c.amber : c.textSecondary;
  const first = name.split(' ')[0];

  const text = firstMove
    ? side === 'responder'
      ? status.state === 'overdue'
        ? t('banner.sayHelloOverdue', { name: first, time: formatDuration(status.remainingMs) })
        : t('banner.sayHelloLeft', { name: first, time: formatDuration(status.remainingMs) })
      : t('banner.notSaidHello', {
          name: first,
          time: formatDuration(status.remainingMs),
          window: windowLabel,
        })
    : side === 'responder'
      ? status.state === 'overdue'
        ? t('banner.waitingOverdue', { name: first, time: formatDuration(status.remainingMs) })
        : t('banner.waitingLeft', { name: first, time: formatDuration(status.remainingMs) })
      : t('banner.notReplied', {
          name: first,
          time: formatDuration(status.remainingMs),
          window: windowLabel,
        });

  return (
    <View style={[local.banner, { borderColor: status.state === 'ok' ? c.border : tone }]}>
      <Clock size={14} color={tone} strokeWidth={2.4} />
      <Text style={[local.text, { color: tone }]}>{text}</Text>
    </View>
  );
}

function useLocalStyles() {
  const c = useTheme().colors;

  return useMemo(
    () =>
      StyleSheet.create({
        banner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 9,
          borderBottomWidth: 1,
          backgroundColor: c.surfaceAlt,
        },

        text: {
          flex: 1,
          fontSize: 13,
          fontWeight: '600',
        },
      }),
    [c]
  );
}
