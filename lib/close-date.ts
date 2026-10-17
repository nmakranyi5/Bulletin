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

// The time of day quick picks and a fresh picker start at.
export const DEFAULT_CLOSE_HOUR = 17;

const pad = (n: number) => String(n).padStart(2, '0');

// The quick-pick chips: N days from now at the default time of day.
export function presetCloseAt(days: number, now: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(DEFAULT_CLOSE_HOUR, 0, 0, 0);
  return d;
}

// Where a picker opens when nothing is set yet: tomorrow at the default time.
export function defaultPickerDate(now: number): Date {
  return presetCloseAt(1, now);
}

export function sameInstant(a: Date | null, b: Date | null): boolean {
  return a === b || (!!a && !!b && a.getTime() === b.getTime());
}

export type CloseAtResult =
  | { ok: true; iso: string | null }
  | { ok: false; error: 'past' | 'too_far' };

// The ISO timestamp to store for a picked date and time, or why it can't be used.
// No date means "no close date".
export function checkCloseAt(date: Date | null, now: number): CloseAtResult {
  if (!date) return { ok: true, iso: null };
  if (date.getTime() <= now) return { ok: false, error: 'past' };
  if (date.getTime() - now > MAX_CLOSE_AHEAD_MS) return { ok: false, error: 'too_far' };
  return { ok: true, iso: date.toISOString() };
}

export const CLOSE_ERRORS = {
  past: 'The close date and time must be in the future.',
  too_far: 'Choose a close date within the next year.',
} as const;

// The saved close_at as a Date to edit (null when there isn't one).
export function closeAtToDate(iso: string | null | undefined): Date | null {
  return iso ? parseServerTime(iso) : null;
}

// "Fri, Oct 30 · 5:00 PM" for the picker field.
export function formatCloseField(date: Date): string {
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

// The browser's <input type="datetime-local"> value for a local date: "2026-10-30T17:00".
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
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
  // Closed by hand (or automatically), whether or not there's a close date.
  if (position.closed_at) return { kind: 'closed' };
  if (!position.close_at) return { kind: 'none' };
  const msLeft = parseServerTime(position.close_at).getTime() - now;
  if (msLeft <= 0) return { kind: 'closed' };
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
  if (state.kind === 'closed') return `Closed ${stamp((position.closed_at ?? position.close_at)!)}`;
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
