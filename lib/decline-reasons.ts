// Reasons for declining an interest. Declining always includes one of these (and an
// optional personal note), so the other person is never left guessing why.
//
// Labels are worded neutrally because the same text is shown to the person picking it
// and to the person who reads it afterwards.

export const DECLINE_REASONS = {
  position_filled: 'The position has been filled',
  missing_certification: 'Missing a required certification',
  not_enough_experience: 'Needs more experience',
  schedule_mismatch: "The schedule doesn't work",
  too_far: 'Too far away',
  chose_another: 'Went with another candidate',
  pay_mismatch: "The pay doesn't match",
  wrong_work: 'Not the right type of work',
  took_another_job: 'Accepted another job',
  other: 'Something else',
} as const;

export type DeclineReason = keyof typeof DECLINE_REASONS;

// What a recruiter can say to a candidate, and what a candidate can say to a recruiter.
export const RECRUITER_DECLINE_REASONS: DeclineReason[] = [
  'position_filled',
  'missing_certification',
  'not_enough_experience',
  'schedule_mismatch',
  'too_far',
  'chose_another',
  'other',
];

export const CANDIDATE_DECLINE_REASONS: DeclineReason[] = [
  'pay_mismatch',
  'schedule_mismatch',
  'too_far',
  'wrong_work',
  'took_another_job',
  'other',
];

export const DECLINE_NOTE_MAX = 280;

export function isDeclineReason(value: string | null | undefined): value is DeclineReason {
  return !!value && Object.prototype.hasOwnProperty.call(DECLINE_REASONS, value);
}

export function reasonsFor(isRecruiter: boolean): DeclineReason[] {
  return isRecruiter ? RECRUITER_DECLINE_REASONS : CANDIDATE_DECLINE_REASONS;
}

export function reasonLabel(reason: string | null | undefined): string | null {
  return isDeclineReason(reason) ? DECLINE_REASONS[reason] : null;
}

// Trim, drop empties, and cap length so a note can never exceed what the database allows.
export function cleanNote(note: string): string | null {
  const trimmed = note.trim().slice(0, DECLINE_NOTE_MAX);
  return trimmed.length > 0 ? trimmed : null;
}

// The alert shown to someone whose interest was declined.
export function declineNotice(
  declined: {
    name: string;
    position?: string | null;
    reason?: string | null;
    note?: string | null;
  }[]
): { title: string; message: string } {
  const describe = (d: (typeof declined)[number]) => reasonLabel(d.reason) ?? 'No reason given';

  if (declined.length === 1) {
    const [d] = declined;
    const where = d.position ? ` in ${d.position}` : '';
    const note = d.note ? `\n\n"${d.note}"` : '';
    return {
      title: 'Not moving forward',
      message: `${d.name} declined your interest${where}.\n\nReason: ${describe(d)}${note}`,
    };
  }

  const lines = declined.slice(0, 3).map((d) => `${d.name}: ${describe(d)}`);
  const more = declined.length > 3 ? `\nand ${declined.length - 3} more` : '';
  return {
    title: `${declined.length} interests were declined`,
    message: `${lines.join('\n')}${more}`,
  };
}
