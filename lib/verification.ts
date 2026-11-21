// Document verification: what people can ask to have checked, how it's labelled, and the
// small amount of validation done before anything is sent (the database checks it again).

import { labelMap, t } from './i18n/core';

export const VERIFICATION_KINDS = ['epa_608', 'contractor_license', 'insurance'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export const KIND_INFO: Record<
  VerificationKind,
  {
    // The badge people see once it's approved.
    badge: string;
    title: string;
    ask: string;
    // What a reviewer should check before approving.
    checklist: (who: { name: string; company?: string | null; state?: string | null }) => string;
  }
> = {
  epa_608: {
    get badge() {
      return t('verif.epa_608.badge');
    },
    get title() {
      return t('verif.epa_608.title');
    },
    get ask() {
      return t('verif.epa_608.ask');
    },
    checklist: ({ name }) => t('verif.epa_608.check', { name }),
  },
  contractor_license: {
    get badge() {
      return t('verif.contractor_license.badge');
    },
    get title() {
      return t('verif.contractor_license.title');
    },
    get ask() {
      return t('verif.contractor_license.ask');
    },
    checklist: ({ name, company, state }) =>
      state
        ? t('verif.contractor_license.check', { state, who: company || name })
        : t('verif.contractor_license.checkNoState', { who: company || name }),
  },
  insurance: {
    get badge() {
      return t('verif.insurance.badge');
    },
    get title() {
      return t('verif.insurance.title');
    },
    get ask() {
      return t('verif.insurance.ask');
    },
    checklist: ({ name, company }) => t('verif.insurance.check', { who: company || name }),
  },
};

// Job seekers get their certification checked; recruiters get their business checked.
export function kindsFor(isRecruiter: boolean): VerificationKind[] {
  return isRecruiter ? ['contractor_license', 'insurance'] : ['epa_608'];
}

export function isKind(value: string | null | undefined): value is VerificationKind {
  return !!value && (VERIFICATION_KINDS as readonly string[]).includes(value);
}

// "EPA 608 verified", "Licensed · TX", "Insured".
export function badgeLabel(kind: string, detail?: string | null): string | null {
  if (!isKind(kind)) return null;
  const base = KIND_INFO[kind].badge;
  return kind === 'contractor_license' && detail ? `${base} · ${detail}` : base;
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export function cleanState(input: string): string {
  return input.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase();
}

export function isStateCode(value: string): boolean {
  return (US_STATES as readonly string[]).includes(value);
}

export function cleanLicenseNumber(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 40);
}

// Why a reviewer turns a request down (shown to the person so they can fix it).
export const REJECT_REASONS = labelMap('reject', [
  'unreadable',
  'name_mismatch',
  'not_found',
  'expired',
  'wrong_document',
  'other',
] as const);
export type RejectReason = keyof typeof REJECT_REASONS;

export const REJECT_REASONS_FOR: Record<VerificationKind, RejectReason[]> = {
  epa_608: ['unreadable', 'name_mismatch', 'expired', 'wrong_document', 'other'],
  contractor_license: ['not_found', 'name_mismatch', 'expired', 'unreadable', 'other'],
  insurance: ['unreadable', 'name_mismatch', 'expired', 'wrong_document', 'other'],
};

// "The name doesn't match the profile: it says J. Smith", capped to what the database allows.
export function rejectionText(reason: RejectReason, note: string | null): string {
  const text = note ? `${REJECT_REASONS[reason]}: ${note}` : REJECT_REASONS[reason];
  return text.slice(0, 400);
}

export const MAX_EVIDENCE_FILES = 4;

export function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|heic|gif)$/i.test(path);
}

export function evidenceExtension(name: string | undefined, mimeType: string | undefined): string {
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(name ?? '')?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.startsWith('image/')) return mimeType.slice(6).replace('jpeg', 'jpg');
  return 'bin';
}
