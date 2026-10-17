import type { Urgency } from '../lib/response-timers';

export type InterestRow = {
  id: string;
  // When the interest was sent; starts its reply timer.
  created_at?: string;
  // Set when the interest was declined, so the sender can see why.
  decline_reason?: string | null;
  decline_note?: string | null;
  declined_at?: string | null;
  // The sender removed this declined interest from their list (the row is kept).
  sender_hidden?: boolean;
  from_user: string;
  to_user: string;
  status: string;
  position_id: string | null;
  from_profile?: {
    id: string;
    name: string;
    username: string;
    avatar_url?: string | null;
    epa_608_types?: string[] | null;
    trade_start_year?: number | null;
  };
  to_profile?: { id: string; name: string; username: string; avatar_url?: string | null };
  position?: {
    id: string;
    title: string;
    company: string;
    epa_608_required?: string | null;
    min_experience_years?: number | null;
    urgency?: string | null;
  } | null;
};

// A match is an accepted interest (an active chat) or a closed one (archived);
// `id` is the interest id.
export type Match = {
  id: string;
  status: 'accepted' | 'closed';
  // Set once the chat is closed.
  closed?: {
    reason: string | null;
    note: string | null;
    at: string | null;
    byMe: boolean;
  };
  otherUserId: string;
  positionId?: string | null;
  // When the match was made, if recorded. Starts the clock for the first message.
  matchedAt?: string | null;
  // Recruiters are expected to open the conversation, so for them the first message
  // is theirs to send; for the other person it's theirs to wait on.
  firstMoveMine?: boolean;
  name: string;
  position: string;
  company: string;
  // The other person's profile photo, if they have one.
  avatarUrl: string | null;
  // How quickly replies are expected; from the posting this match came from.
  urgency: Urgency;
};
