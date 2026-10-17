import { Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../lib/app-theme';
import { NEW_RATING, Rating, formatRating, ratingDetail } from '../../lib/rating';

const STAR = '#F59E0B';

// "★ 4.8 · 11 of 12 replies on time". Everyone starts at 5.0.
export function RatingBadge({ rating = NEW_RATING }: { rating?: Rating }) {
  const c = useTheme().colors;
  const local = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
        value: { fontSize: 13, fontWeight: '800', color: c.text },
        detail: { fontSize: 12, color: c.textSecondary, flexShrink: 1 },
      }),
    [c]
  );
  const detail = ratingDetail(rating);

  return (
    <View style={local.row}>
      <Star size={14} color={STAR} fill={STAR} strokeWidth={2} />
      <Text style={local.value}>{formatRating(rating.rating)}</Text>
      {detail ? (
        <Text numberOfLines={1} style={local.detail}>
          · {detail}
        </Text>
      ) : null}
    </View>
  );
}
