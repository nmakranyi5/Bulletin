// Hire-by / close dates for positions.
//
// A position can have a date and time when it closes automatically. Dates are entered
// and shown in the phone's local time and stored as UTC instants (`close_at`).

import { formatDuration } from './response-timers';
import { parseServerTime } from './time';

const DAY = 86_400_000;

// Reminders to extend or confirm start this long before the position closes.
export const REMINDER_LEAD_MS = 2 * DAY;
// How far ahead a close date can be set.
export const MAX_CLOSE_AHEAD_MS = 365 * DAY;

export const CLOSE_PRESETS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '30 days', days: 30 },
] as const;

export const EXTEND_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
] as const;

export const CLOSE_TIMES = [
  { label: '8:00 AM', hour: 8, minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '5:00 PM', hour: 17, minute: 0 },
  { label: '11:59 PM', hour: 23, minute: 59 },
] as const;

export type CloseTime = (typeof CLOSE_TIMES)[number];
export const DEFAULT_CLOSE_TIME: CloseTime = CLOSE_TIMES[2];

const pad = (n: number) => String(n).padStart(2, '0');

// "MM/DD/YYYY" for a date in local time.
export function formatDateInput(date: Date): string {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

// The date `days` from now, as MM/DD/YYYY, for the quick-pick chips.
export function dateInputAfter(days: number, now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return formatDateInput(d);
}

// "MM/DD/YYYY" (or M/D/YYYY) to a real calendar date; null if empty, 'invalid' if not a date.
export function parseDateInput(input: string): { y: number; m: number; d: number } | null | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return 'invalid';
  const [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) {
    return 'invalid';
  }
  return { y, m, d };
}

export type CloseAtResult =
  | { ok: true; iso: string | null }
  | { ok: false; error: 'invalid' | 'past' | 'too_far' };

// The ISO timestamp to store for a typed date + chosen time, or why it can't be used.
// An empty date means "no close date".
export function buildCloseAt(
  dateInput: string,
  time: { hour: number; minute: number },
  now: number
): CloseAtResult {
  const parsed = parseDateInput(dateInput);
  if (parsed === null) return { ok: true, iso: null };
  if (parsed === 'invalid') return { ok: false, error: 'invalid' };
  const at = new Date(parsed.y, parsed.m - 1, parsed.d, time.hour, time.minute, 0, 0);
  if (at.getTime() <= now) return { ok: false, error: 'past' };
  if (at.getTime() - now > MAX_CLOSE_AHEAD_MS) return { ok: false, error: 'too_far' };
  return { ok: true, iso: at.toISOString() };
}

export const CLOSE_ERRORS = {
  invalid: 'Enter the date as MM/DD/YYYY, e.g. 11/15/2026.',
  past: 'The close date and time must be in the future.',
  too_far: 'Choose a close date within the next year.',
} as const;

// Pre-fills the form from a saved close_at: the date, and the nearest time chip.
export function splitCloseAt(iso: string | null | undefined): { date: string; time: CloseTime } {
  if (!iso) return { date: '', time: DEFAULT_CLOSE_TIME };
  const d = parseServerTime(iso);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const time = CLOSE_TIMES.reduce((best, t) =>
    Math.abs(t.hour * 60 + t.minute - minutes) < Math.abs(best.hour * 60 + best.minute - minutes)
      ? t
      : best
  );
  return { date: formatDateInput(d), time };
}

type Closable = {
  active?: boolean | null;
  close_at?: string | null;
  closed_at?: string | null;
  close_confirmed_at?: string | null;
};

export type CloseState =
  | { kind: 'none' }
  | { kind: 'open'; msLeft: number }
  // Within the reminder window and not confirmed yet.
  | { kind: 'soon'; msLeft: number }
  | { kind: 'confirmed'; msLeft: number }
  | { kind: 'closed' };

export function closeState(position: Closable, now: number): CloseState {
  if (!position.close_at) return { kind: 'none' };
  const msLeft = parseServerTime(position.close_at).getTime() - now;
  if (position.closed_at || msLeft <= 0) return { kind: 'closed' };
  if (position.close_confirmed_at) return { kind: 'confirmed', msLeft };
  return msLeft <= REMINDER_LEAD_MS ? { kind: 'soon', msLeft } : { kind: 'open', msLeft };
}

// Open for candidates right now: active, and its close date (if any) hasn't passed.
export function isOpenForCandidates(position: Closable, now: number): boolean {
  if (position.active === false) return false;
  return closeState(position, now).kind !== 'closed';
}

function stamp(iso: string): string {
  const d = parseServerTime(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}, ${time}`;
}

// "Closes Oct 30", for a card tag; null when there's no close date.
export function closesOn(position: Closable): string | null {
  if (!position.close_at) return null;
  const d = parseServerTime(position.close_at);
  return `Closes ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// "Closes Oct 30, 5:00 PM · in 2d 3h" / "Closed Oct 30, 5:00 PM"
export function closeLabel(position: Closable, now: number): string | null {
  const state = closeState(position, now);
  if (state.kind === 'none') return null;
  if (state.kind === 'closed') return `Closed ${stamp(position.close_at!)}`;
  return `Closes ${stamp(position.close_at!)} · in ${formatDuration(state.msLeft)}`;
}

// A new close date this many days after the later of the current one and now, keeping
// the time of day. (Extending a position that already closed counts from now.)
export function extendedCloseAt(
  currentIso: string | null | undefined,
  days: number,
  now: number
): string {
  const base = currentIso ? Math.max(parseServerTime(currentIso).getTime(), now) : now;
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// The reminder shown to the recruiter as a close date approaches.
export function reminderCopy(
  due: { title: string; msLeft: number }[]
): { title: string; message: string } {
  if (due.length === 1) {
    const [p] = due;
    return {
      title: 'Position closing soon',
      message: `${p.title} closes in ${formatDuration(p.msLeft)}. Extend the date to keep it open, or confirm that it should close then. People who are still waiting on it get their interest back, and chats stay open.`,
    };
  }
  const names = due.slice(0, 3).map((p) => p.title).join(', ');
  return {
    title: `${due.length} positions closing soon`,
    message: `${names}${due.length > 3 ? ' and others' : ''} will close within ${formatDuration(
      Math.max(...due.map((p) => p.msLeft))
    )}. Open Your Positions to extend or confirm them.`,
  };
}

// The notice for someone whose interest was returned because the position closed.
export function closedNotice(
  closed: { name: string; position?: string | null }[]
): { title: string; message: string } {
  if (closed.length === 1) {
    const [c] = closed;
    return {
      title: 'Position closed',
      message: `${c.position ?? 'A position'} at ${c.name} has closed, so your interest was returned. You can use it again.`,
    };
  }
  const lines = closed.slice(0, 3).map((c) => `${c.position ?? 'A position'} · ${c.name}`);
  const more = closed.length > 3 ? `\nand ${closed.length - 3} more` : '';
  return {
    title: `${closed.length} positions closed`,
    message: `${lines.join('\n')}${more}\n\nYour interests were returned.`,
  };
}
