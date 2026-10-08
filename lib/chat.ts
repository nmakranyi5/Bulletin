// Chat helpers: time formatting and conversation summaries.

export type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

export type ConversationMeta = {
  lastText: string;
  lastAt: string;
  lastFromMe: boolean;
  lastRead: boolean;
  unread: number;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
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
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function isSameDay(a: string, b: string): boolean {
  return sameDay(new Date(a), new Date(b));
}

// rows must be ordered newest first.
export function summarizeConversations(
  rows: { interest_id: string; sender_id: string; body: string; created_at: string; read_at: string | null }[],
  userId: string
): Record<string, ConversationMeta> {
  const out: Record<string, ConversationMeta> = {};
  for (const r of rows) {
    const fromMe = r.sender_id === userId;
    const meta = (out[r.interest_id] ??= {
      lastText: r.body,
      lastAt: r.created_at,
      lastFromMe: fromMe,
      lastRead: !!r.read_at,
      unread: 0,
    });
    if (!fromMe && !r.read_at) meta.unread += 1;
  }
  return out;
}
