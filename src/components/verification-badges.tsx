import { BadgeCheck } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { badgeLabel } from '../../lib/verification';
import type { Verification } from '../features/profile/verifications';

// "EPA 608 verified", "Licensed · TX", "Insured": what a reviewer has checked. Renders
// nothing when there's none.
export function VerificationBadges({ items }: { items?: Verification[] | null }) {
  const c = useTheme().colors;
  const local = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.green,
        },
        text: { fontSize: 11, fontWeight: '800', color: c.green },
      }),
    [c]
  );
  const labels = (items ?? [])
    .map((v) => ({ kind: v.kind, label: badgeLabel(v.kind, v.detail) }))
    .filter((v): v is { kind: Verification['kind']; label: string } => !!v.label);
  if (labels.length === 0) return null;

  return (
    <View style={local.wrap}>
      {labels.map((v) => (
        <View key={v.kind} style={local.chip}>
          <BadgeCheck size={12} color={c.green} strokeWidth={2.6} />
          <Text style={local.text}>{v.label}</Text>
        </View>
      ))}
    </View>
  );
}
