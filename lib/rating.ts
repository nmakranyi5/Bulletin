// Response rating: everyone starts at 5.0 stars. Replying on time keeps it up (and
// recovers it after a miss); missing a reply deadline lowers it. The database computes
// it (get_ratings); this mirrors the formula for display and tests.

export const RATING_MAX = 5;
// Only the most recent responses count, so a rough patch fades.
export const RATING_RECENT_COUNT = 30;
// Everyone starts with a head start of three on-time replies.
export const RATING_PRIOR = 3;

export type Rating = {
  rating: number;
  onTime: number;
  late: number;
};

export const NEW_RATING: Rating = { rating: RATING_MAX, onTime: 0, late: 0 };

export function computeRating(onTime: number, late: number): number {
  const raw = (RATING_MAX * (onTime + RATING_PRIOR)) / (onTime + late + RATING_PRIOR);
  return Math.round(raw * 10) / 10;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

// "11 of 12 replies on time", or null before there's anything to report.
export function ratingDetail(r: Rating): string | null {
  const total = r.onTime + r.late;
  if (total === 0) return null;
  return `${r.onTime} of ${total} ${total === 1 ? 'reply' : 'replies'} on time`;
}

export function parseRatingRow(row: any): Rating {
  return {
    rating: Number(row?.rating ?? RATING_MAX),
    onTime: Number(row?.on_time ?? 0),
    late: Number(row?.late ?? 0),
  };
}
