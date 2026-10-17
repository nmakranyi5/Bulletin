// Chat helpers: time formatting and conversation summaries.

import { parseServerTime, serverNow } from './time';

export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export type ConversationMeta = {
  lastText: string;
  lastAt: string;
  lastFromMe: boolean;
  lastRead: boolean;
  unread: number;
  // When the oldest message in the unanswered run from the other person was sent
  // (null if you've replied since, or they haven't written). Drives reply timers.
  awaitingSince: string | null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatTime(iso: string): string {
  return parseServerTime(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLabel(iso: string): string {
  const d = parseServerTime(iso);
  const now = new Date(serverNow());
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}

// Compact timestamp for the conversation list.
export function formatListTime(iso: string): string {
  const d = parseServerTime(iso);
  const now = new Date(serverNow());
  if (sameDay(d, now)) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function isSameDay(a: string, b: string): boolean {
  return sameDay(parseServerTime(a), parseServerTime(b));
}

// rows must be ordered newest first.
export function summarizeConversations(
  rows: {
    interest_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
    deleted_at?: string | null;
  }[],
  userId: string
): Record<string, ConversationMeta> {
  const out: Record<string, ConversationMeta> = {};
  // Rows are newest first. Once we reach one of my own messages, anything older
  // from them was already answered.
  const answered = new Set<string>();
  for (const r of rows) {
    const fromMe = r.sender_id === userId;
    const meta = (out[r.interest_id] ??= {
      lastText: r.deleted_at ? 'Message deleted' : r.body,
      lastAt: r.created_at,
      lastFromMe: fromMe,
      lastRead: !!r.read_at,
      unread: 0,
      awaitingSince: null,
    });
    if (!fromMe && !r.read_at && !r.deleted_at) meta.unread += 1;

    if (fromMe) answered.add(r.interest_id);
    // A deleted message no longer needs an answer.
    else if (!answered.has(r.interest_id) && !r.deleted_at) meta.awaitingSince = r.created_at;
  }
  return out;
}
