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

// Postings can list several schedules; falls back to the legacy single schedule_type.
export function getSchedules(position: {
  schedule_types?: string[] | null;
  schedule_type?: string | null;
}): string[] {
  if (position.schedule_types?.length) return position.schedule_types;
  return position.schedule_type ? [position.schedule_type] : [];
}

export const PAY_TYPES = ['Hourly', 'Salary'] as const;
export type PayType = (typeof PAY_TYPES)[number];

// Things techs ask about that often matter as much as the base rate.
export const PAY_EXTRAS = [
  'Overtime',
  'On-call pay',
  'Commission / bonus',
  'Take-home van',
  'Tools provided',
] as const;

export function parsePay(input: string): number | null | 'invalid' {
  const trimmed = input.trim().replace(/[$,]/g, '');
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  const n = Number(trimmed);
  return n > 0 && n < 10_000_000 ? n : 'invalid';
}

function money(n: number, type: string): string {
  if (type === 'Salary' && n >= 1000) {
    const k = Math.round((n / 1000) * 10) / 10;
    return `$${k}k`;
  }
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// "$28–$38/hr" or "$55k–$70k/yr"; falls back to the legacy free-text pay_range.
export function formatPay(position: {
  pay_type?: string | null;
  pay_min?: number | null;
  pay_max?: number | null;
  pay_range?: string | null;
}): string | null {
  const { pay_type: type, pay_min: min, pay_max: max } = position;
  if (type && (min != null || max != null)) {
    const unit = type === 'Hourly' ? '/hr' : '/yr';
    const lo = min ?? max!;
    const hi = max ?? min!;
    const range = lo === hi ? money(lo, type) : `${money(lo, type)}–${money(hi, type)}`;
    return `${range}${unit}`;
  }
  return position.pay_range || null;
}
