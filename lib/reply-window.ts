// Agreed reply times for a chat.
//
// Everyone sets how fast they usually reply (1 to 5 whole days) in their profile. A new match
// starts at the midpoint of the two settings, rounded up to a whole day; an urgent posting starts at
// its 2-hour promise instead. Either person can ask to change it (urgent postings get shorter
// options too) and it changes only if the other accepts. A change applies to messages sent after it.
// The database does the same arithmetic (see the reply_windows migration); this mirrors it.

import { URGENCY, formatHours } from './response-timers';
import type { Urgency } from './response-timers';

export { formatHours };
import { parseServerTime } from './time';

export const REPLY_DAY_OPTIONS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_REPLY_DAYS = 2;
// Shorter choices only urgent postings offer.
export const URGENT_EXTRA_HOURS = [2, 4, 12] as const;

const HOUR = 3_600_000;

export function isReplyDays(value: unknown): value is number {
  return typeof value === 'number' && (REPLY_DAY_OPTIONS as readonly number[]).includes(value);
}

// The midpoint of two people's settings, rounded up to a whole day.
export function agreedDays(a: number, b: number): number {
  return Math.ceil((a + b) / 2);
}

// Where a new match starts, in hours.
export function startingHours(urgent: boolean, a: number, b: number): number {
  return urgent ? 2 : agreedDays(a, b) * 24;
}

// What can be asked for in a chat, shortest first.
export function windowOptions(urgent: boolean): number[] {
  const days = REPLY_DAY_OPTIONS.map((d) => d * 24);
  return urgent ? [...URGENT_EXTRA_HOURS, ...days] : days;
}

export type WindowChange = { from: string; hours: number };

// The window in force for a message sent at `at`: the latest change on or before it, or the
// posting's urgency window for chats made before agreed windows existed.
export function windowMsAt(
  history: WindowChange[] | undefined,
  at: string | number,
  urgency: Urgency
): number {
  const when = typeof at === 'number' ? at : parseServerTime(at).getTime();
  let hours: number | null = null;
  let latest = -Infinity;
  for (const c of history ?? []) {
    const from = parseServerTime(c.from).getTime();
    if (from <= when && from >= latest) {
      latest = from;
      hours = c.hours;
    }
  }
  return hours === null ? URGENCY[urgency].windowMs : hours * HOUR;
}

export type ReplyRequest = {
  id: string;
  interestId: string;
  requestedBy: string;
  hours: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
};

export function parseReplyRequest(row: any): ReplyRequest {
  return {
    id: row.id,
    interestId: row.interest_id,
    requestedBy: row.requested_by,
    hours: Number(row.hours),
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    decidedAt: row.decided_at ?? null,
  };
}

// What the person who asked is told once their request is settled.
export function requestOutcomeNotice(
  requests: { name: string; hours: number; status: ReplyRequest['status'] }[]
): { title: string; message: string } {
  const line = (r: (typeof requests)[number]) => {
    const what = `a ${formatHours(r.hours)} reply time`;
    return r.status === 'accepted'
      ? `${r.name} agreed to ${what}.`
      : r.status === 'declined'
        ? `${r.name} declined ${what}.`
        : `${r.name} didn't answer your request for ${what} in time, so it expired.`;
  };
  if (requests.length === 1) {
    const [r] = requests;
    return {
      title:
        r.status === 'accepted'
          ? 'Reply time changed'
          : r.status === 'declined'
            ? 'Request declined'
            : 'Request expired',
      message: line(r) + (r.status === 'accepted' ? '' : ' The reply time stays as it was.'),
    };
  }
  return { title: `${requests.length} reply time updates`, message: requests.map(line).join('\n') };
}

// What the other person is told when someone asks to change the window.
export function incomingRequestNotice(name: string, hours: number): { title: string; message: string } {
  return {
    title: 'Reply time request',
    message: `${name} would like to change your reply time to ${formatHours(hours)}. Open the chat to accept or decline.`,
  };
}
