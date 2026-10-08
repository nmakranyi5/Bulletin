// HVAC-specific field options and EPA 608 matching logic.

export const EPA_TYPES = ['I', 'II', 'III'] as const;
export type EpaType = (typeof EPA_TYPES)[number];

export const TRADE_ROLES = ['Helper', 'Installer', 'Service Tech', 'Lead'] as const;

export const SCHEDULE_TYPES = [
  'Standard hours',
  'Weekend rotation',
  'On-call / emergency',
] as const;

// Worker holds Universal once all three types are checked.
export function isUniversal(types: readonly string[] | null | undefined): boolean {
  return !!types && EPA_TYPES.every((t) => types.includes(t));
}

export function formatWorkerEpa(types: readonly string[] | null | undefined): string {
  if (!types || types.length === 0) return 'No EPA 608';
  if (isUniversal(types)) return 'EPA 608 Universal';
  return `EPA 608 ${EPA_TYPES.filter((t) => types.includes(t))
    .map((t) => `Type ${t}`)
    .join(', ')}`;
}

// The three types are parallel categories; only Universal is a superset.
export function satisfiesEpa(
  required: string | null | undefined,
  held: readonly string[] | null | undefined
): boolean {
  if (!required) return true;
  return !!held && (held.includes(required) || isUniversal(held));
}

// Soft flag: returns a human-readable mismatch note, or null when fine / not applicable.
export function epaMismatchNote(
  required: string | null | undefined,
  held: readonly string[] | null | undefined
): string | null {
  if (!required || satisfiesEpa(required, held)) return null;
  return `Requires EPA 608 Type ${required}`;
}

export function formatTradeStart(year: number | null | undefined): string | null {
  return year ? `Started ${year}` : null;
}

export function parseYear(input: string): number | null | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d{4}$/.test(trimmed)) return 'invalid';
  const year = Number(trimmed);
  return year >= 1950 && year <= new Date().getFullYear() ? year : 'invalid';
}

export function parseMinYears(input: string): number | null | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d{1,2}$/.test(trimmed)) return 'invalid';
  return Number(trimmed);
}

export function yearsInTrade(startYear: number | null | undefined): number | null {
  return startYear ? Math.max(0, new Date().getFullYear() - startYear) : null;
}

// Soft flag for minimum experience.
export function experienceMismatchNote(
  minYears: number | null | undefined,
  startYear: number | null | undefined
): string | null {
  if (!minYears) return null;
  const have = yearsInTrade(startYear);
  if (have !== null && have >= minYears) return null;
  return `Wants ${minYears}+ yrs experience`;
}
