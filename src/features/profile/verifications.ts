import { VerificationKind } from '../../../lib/verification';
import { supabase } from '../../../lib/supabase';

export type Verification = { kind: VerificationKind; detail: string | null };

// The current badges for several people. Anyone missing from the result has none, and a
// failed lookup just shows no badges, so it never blocks a screen.
export async function fetchVerifications(userIds: string[]): Promise<Record<string, Verification[]>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out: Record<string, Verification[]> = {};
  ids.forEach((id) => (out[id] = []));
  if (ids.length === 0) return out;

  const { data, error } = await supabase.rpc('get_verifications', { p_user_ids: ids });
  if (error) return out;
  (data ?? []).forEach((row: any) => {
    out[row.user_id]?.push({ kind: row.kind, detail: row.detail ?? null });
  });
  return out;
}
