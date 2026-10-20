// Document verification: what people can ask to have checked, how it's labelled, and the
// small amount of validation done before anything is sent (the database checks it again).

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
    badge: 'EPA 608 verified',
    title: 'EPA 608 certification',
    ask: 'Upload a clear photo of your EPA 608 card. The name on it must match your profile.',
    checklist: ({ name }) =>
      `Is the name on the card ${name}? Does it show the certification types they claim?`,
  },
  contractor_license: {
    badge: 'Licensed',
    title: 'Contractor license',
    ask: 'Enter your contractor license number and state. A photo of the license helps, but is optional.',
    checklist: ({ name, company, state }) =>
      `Look the number up on ${state ?? 'the'} state licensing board's site. Is it active, and does it belong to ${company || name}?`,
  },
  insurance: {
    badge: 'Insured',
    title: 'Certificate of insurance',
    ask: 'Upload your certificate of insurance (a photo or PDF). The business name must match your profile.',
    checklist: ({ name, company }) =>
      `Does the insured business match ${company || name}? Is the policy current?`,
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
export const REJECT_REASONS = {
  unreadable: "The photo or file couldn't be read",
  name_mismatch: "The name doesn't match the profile",
  not_found: "We couldn't find that license",
  expired: 'It has expired',
  wrong_document: "That isn't the right document",
  other: 'Something else',
} as const;
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
