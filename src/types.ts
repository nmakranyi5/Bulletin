import type { Urgency } from '../lib/response-timers';

export type InterestRow = {
  id: string;
  // When the interest was sent; starts its reply timer.
  created_at?: string;
  from_user: string;
  to_user: string;
  status: string;
  position_id: string | null;
  from_profile?: {
    id: string;
    name: string;
    username: string;
    epa_608_types?: string[] | null;
    trade_start_year?: number | null;
  };
  to_profile?: { id: string; name: string; username: string };
  position?: {
    id: string;
    title: string;
    company: string;
    epa_608_required?: string | null;
    min_experience_years?: number | null;
    urgency?: string | null;
  } | null;
};

// A match is an accepted interest; `id` is the interest id.
export type Match = {
  id: string;
  otherUserId: string;
  name: string;
  position: string;
  company: string;
  // How quickly replies are expected; from the posting this match came from.
  urgency: Urgency;
};
