// Anti-ghosting response timers.
//
// Each job posting has an urgency level, and each level sets how long the person
// who owes a reply has to give one. Timers never close or change a chat; they only
// show how much time is left and trigger an alert when the limit is reached.

import { parseServerTime, serverNow } from './time';

export const URGENCY_LEVELS = ['urgent', 'standard', 'flexible'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

const HOUR = 3_600_000;

export const URGENCY: Record<
  Urgency,
  { label: string; article: string; windowMs: number; windowLabel: string; blurb: string }
> = {
  urgent: {
    label: 'Urgent',
    article: 'an urgent',
    windowMs: 2 * HOUR,
    windowLabel: '2 hours',
    blurb: 'Hiring fast, e.g. an open emergency-service slot.',
  },
  standard: {
    label: 'Standard',
    article: 'a standard',
    windowMs: 24 * HOUR,
    windowLabel: '24 hours',
    blurb: 'A normal hiring pace.',
  },
  flexible: {
    label: 'Flexible',
    article: 'a flexible',
    windowMs: 72 * HOUR,
    windowLabel: '3 days',
    blurb: 'No rush, building a pipeline.',
  },
};

// Postings without an urgency (older ones, or "General" interests) count as standard.
export function urgencyOf(position?: { urgency?: string | null } | null): Urgency {
  const u = position?.urgency;
  return u && (URGENCY_LEVELS as readonly string[]).includes(u) ? (u as Urgency) : 'standard';
}

export type TimerState = 'ok' | 'soon' | 'overdue';

export type TimerStatus = {
  state: TimerState;
  // Positive while time remains, negative once overdue.
  remainingMs: number;
  dueAt: number;
};

// "Soon" = the last quarter of the window (30 min for urgent, 6 h for standard).
const SOON_FRACTION = 0.25;

export function timerStatus(
  sinceIso: string,
  urgency: Urgency,
  now: number = serverNow()
): TimerStatus {
  const windowMs = URGENCY[urgency].windowMs;
  const dueAt = parseServerTime(sinceIso).getTime() + windowMs;
  const remainingMs = dueAt - now;
  const state: TimerState =
    remainingMs <= 0 ? 'overdue' : remainingMs <= windowMs * SOON_FRACTION ? 'soon' : 'ok';
  return { state, remainingMs, dueAt };
}

// "45m", "1h 20m", "2h", "2d 3h", "under 1m"
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60_000);
  if (totalMin < 1) return 'under 1m';
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

// Whose side of the conversation we're describing.
//  - 'responder': you owe the reply ("1h 20m left to reply")
//  - 'waiting':   you're waiting on them ("Reply due in 1h 20m")
export function timerLabel(status: TimerStatus, side: 'responder' | 'waiting'): string {
  if (status.state === 'overdue') {
    return side === 'responder'
      ? `Reply overdue by ${formatDuration(status.remainingMs)}`
      : `No reply yet, overdue by ${formatDuration(status.remainingMs)}`;
  }
  const left = formatDuration(status.remainingMs);
  return side === 'responder' ? `${left} left to reply` : `Reply due in ${left}`;
}

// A reply someone currently owes.
export type PendingReply = {
  // Stable per unanswered run, so a fresh unanswered message gets a fresh key.
  key: string;
  kind: 'interest' | 'chat';
  // The interest id (a chat's id is its interest's id).
  id: string;
  name: string;
  urgency: Urgency;
  since: string;
};

export function overdueReplies(items: PendingReply[], now: number): PendingReply[] {
  return items.filter((i) => timerStatus(i.since, i.urgency, now).state === 'overdue');
}

// Overdue replies we haven't alerted about yet.
export function newlyOverdue(
  items: PendingReply[],
  alerted: ReadonlySet<string>,
  now: number
): PendingReply[] {
  return overdueReplies(items, now).filter((i) => !alerted.has(i.key));
}

export function alertCopy(
  due: PendingReply[],
  now: number
): { title: string; message: string } {
  if (due.length === 1) {
    const [item] = due;
    const waited = formatDuration(now - parseServerTime(item.since).getTime());
    const cfg = URGENCY[item.urgency];
    return {
      title: 'Time to reply',
      message:
        item.kind === 'interest'
          ? `${item.name} has been waiting ${waited} for an answer to their interest. This is ${cfg.article} role, so a reply is expected within ${cfg.windowLabel}.`
          : `${item.name} has been waiting ${waited} for your reply. This is ${cfg.article} role, so a reply is expected within ${cfg.windowLabel}.`,
    };
  }
  const names = due.slice(0, 3).map((d) => d.name).join(', ');
  return {
    title: `${due.length} replies are overdue`,
    message: `${names}${due.length > 3 ? ' and others' : ''} are waiting on you.`,
  };
}
