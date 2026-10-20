import { ShieldCheck } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';

// "Phone verified": this person confirmed a real phone number. (The number itself is never
// shown to anyone.) Renders nothing when they haven't.
export function VerifiedBadge({ verifiedAt }: { verifiedAt?: string | null }) {
  const c = useTheme().colors;
  const local = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
        text: { fontSize: 12, fontWeight: '700', color: c.green },
      }),
    [c]
  );
  if (!verifiedAt) return null;

  return (
    <View style={local.row}>
      <ShieldCheck size={14} color={c.green} strokeWidth={2.4} />
      <Text style={local.text}>Phone verified</Text>
    </View>
  );
}
