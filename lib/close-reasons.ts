// Reasons for closing a chat. Closing always carries one of these (and an optional
// note), and the chat moves to the Archived section for both people.
//
// `deal_closed` is the positive outcome; everything else means the conversation ended
// without a deal. Labels are worded neutrally because the same text is shown to the
// person picking it and to the person who reads it afterwards.

import { DECLINE_REASONS, DECLINE_NOTE_MAX } from './decline-reasons';

export const CLOSE_REASONS = {
  deal_closed: 'We made a deal',
  not_interested: 'Not interested',
  no_response: 'The conversation went quiet',
  position_filled: DECLINE_REASONS.position_filled,
  missing_certification: DECLINE_REASONS.missing_certification,
  not_enough_experience: DECLINE_REASONS.not_enough_experience,
  schedule_mismatch: DECLINE_REASONS.schedule_mismatch,
  too_far: DECLINE_REASONS.too_far,
  chose_another: DECLINE_REASONS.chose_another,
  pay_mismatch: DECLINE_REASONS.pay_mismatch,
  wrong_work: DECLINE_REASONS.wrong_work,
  took_another_job: DECLINE_REASONS.took_another_job,
  other: DECLINE_REASONS.other,
} as const;

export type CloseReason = keyof typeof CLOSE_REASONS;

export const POSITIVE_CLOSE_REASON: CloseReason = 'deal_closed';

export const RECRUITER_CLOSE_REASONS: CloseReason[] = [
  'deal_closed',
  'not_interested',
  'position_filled',
  'missing_certification',
  'not_enough_experience',
  'schedule_mismatch',
  'too_far',
  'chose_another',
  'no_response',
  'other',
];

export const CANDIDATE_CLOSE_REASONS: CloseReason[] = [
  'deal_closed',
  'not_interested',
  'pay_mismatch',
  'schedule_mismatch',
  'too_far',
  'wrong_work',
  'took_another_job',
  'no_response',
  'other',
];

export const CLOSE_NOTE_MAX = DECLINE_NOTE_MAX;

export function isCloseReason(value: string | null | undefined): value is CloseReason {
  return !!value && Object.prototype.hasOwnProperty.call(CLOSE_REASONS, value);
}

export function closeReasonsFor(isRecruiter: boolean): CloseReason[] {
  return isRecruiter ? RECRUITER_CLOSE_REASONS : CANDIDATE_CLOSE_REASONS;
}

export function closeReasonLabel(reason: string | null | undefined): string | null {
  return isCloseReason(reason) ? CLOSE_REASONS[reason] : null;
}

export function isDeal(reason: string | null | undefined): boolean {
  return reason === POSITIVE_CLOSE_REASON;
}

// One line for an archived chat: "Deal closed" or "Closed · Not interested".
export function closeOutcome(reason: string | null | undefined): string {
  if (isDeal(reason)) return 'Deal closed';
  const label = closeReasonLabel(reason);
  return label ? `Closed · ${label}` : 'Closed';
}
