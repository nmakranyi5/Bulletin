import { NEW_RATING, Rating, parseRatingRow } from '../../../lib/rating';
import { supabase } from '../../../lib/supabase';

// Looks up response ratings. Anyone missing from the result (or on an error) simply
// shows the starting 5.0, so a failed lookup never blocks a screen.
export async function fetchRatings(userIds: string[]): Promise<Record<string, Rating>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return {};

  const { data, error } = await supabase.rpc('get_ratings', { p_user_ids: ids });
  const out: Record<string, Rating> = {};
  ids.forEach((id) => (out[id] = NEW_RATING));
  if (error) return out;

  (data ?? []).forEach((row: any) => {
    out[row.user_id] = parseRatingRow(row);
  });
  return out;
}
