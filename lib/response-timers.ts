// Anti-ghosting response timers.
//
// Each job posting has an urgency level, and each level sets how long the person
// who owes a reply has to give one. Timers never close or change a chat; they only
// show how much time is left and trigger an alert when the limit is reached.

import { t } from './i18n/core';
import { parseServerTime, serverNow } from './time';

export const URGENCY_LEVELS = ['urgent', 'standard', 'flexible'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

const HOUR = 3_600_000;

// Getters, so the text follows the current language each time it is read.
function level(u: Urgency, windowMs: number) {
  return {
    windowMs,
    get label() {
      return t(`urgency.${u}.label`);
    },
    get article() {
      return t(`urgency.${u}.article`);
    },
    get windowLabel() {
      return t(`urgency.${u}.window`);
    },
    get blurb() {
      return t(`urgency.${u}.blurb`);
    },
  };
}

export const URGENCY: Record<
  Urgency,
  { label: string; article: string; windowMs: number; windowLabel: string; blurb: string }
> = {
  urgent: level('urgent', 2 * HOUR),
  standard: level('standard', 24 * HOUR),
  flexible: level('flexible', 72 * HOUR),
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
  return timerStatusFor(sinceIso, URGENCY[urgency].windowMs, now);
}

// The same, for an explicit window (a chat's agreed reply time).
export function timerStatusFor(
  sinceIso: string,
  windowMs: number,
  now: number = serverNow()
): TimerStatus {
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
  if (totalMin < 1) return t('dur.under1m');
  if (totalMin < 60) return t('dur.m', { m: totalMin });
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) return mins ? t('dur.hm', { h: hours, m: mins }) : t('dur.h', { h: hours });
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? t('dur.dh', { d: days, h: remHours }) : t('dur.d', { d: days });
}

// Whose side of the conversation we're describing.
//  - 'responder': you owe the reply ("1h 20m left to reply")
//  - 'waiting':   you're waiting on them ("Reply due in 1h 20m")
export function timerLabel(status: TimerStatus, side: 'responder' | 'waiting'): string {
  if (status.state === 'overdue') {
    return side === 'responder'
      ? t('timer.replyOverdue', { time: formatDuration(status.remainingMs) })
      : t('timer.noReplyOverdue', { time: formatDuration(status.remainingMs) });
  }
  const left = formatDuration(status.remainingMs);
  return side === 'responder'
    ? t('timer.leftToReply', { time: left })
    : t('timer.replyDueIn', { time: left });
}

// A reply someone currently owes.
export type PendingReply = {
  // Stable per unanswered run, so a fresh unanswered message gets a fresh key.
  key: string;
  kind: 'interest' | 'chat';
  // A chat with no messages yet: this is the reply to "say hello", not to a message.
  firstMove?: boolean;
  // The interest id (a chat's id is its interest's id).
  id: string;
  name: string;
  urgency: Urgency;
  since: string;
  // The chat's agreed reply time, when there is one (it replaces the urgency window).
  windowMs?: number;
};

// The reply window for an item: the chat's agreed time if it has one, else its urgency window.
export function windowOf(item: PendingReply): number {
  return item.windowMs ?? URGENCY[item.urgency].windowMs;
}

// "2 hours", "1 day", "3 days"
export function formatHours(hours: number): string {
  if (hours < 24) return t('hours', { count: hours });
  const days = Math.round(hours / 24);
  return t('days', { count: days });
}

export function overdueReplies(items: PendingReply[], now: number): PendingReply[] {
  return items.filter((i) => timerStatusFor(i.since, windowOf(i), now).state === 'overdue');
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
    // A chat's reply time was agreed by both people; an interest follows the posting's urgency.
    const rule =
      item.kind === 'chat' && item.windowMs !== undefined
        ? t('timer.ruleAgreed', { window: formatHours(item.windowMs / 3_600_000) })
        : t('timer.ruleUrgency', {
            article: cfg.article,
            what: item.firstMove ? t('timer.firstMessage') : t('timer.aReply'),
            window: cfg.windowLabel,
          });
    return {
      title: t('timer.alertTitle'),
      message:
        item.kind === 'interest'
          ? t('timer.alertInterest', { name: item.name, waited, rule })
          : item.firstMove
          ? t('timer.alertFirstMove', { name: item.name, waited, rule })
          : t('timer.alertChat', { name: item.name, waited, rule }),
    };
  }
  const names = due.slice(0, 3).map((d) => d.name).join(', ');
  return {
    title: t('timer.overdueTitle', { count: due.length }),
    message: t(due.length > 3 ? 'timer.overdueMessageMore' : 'timer.overdueMessage', { names }),
  };
}
