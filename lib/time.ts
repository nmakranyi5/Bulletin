// Time handling that doesn't depend on where the phone is or what its clock says.
//
// Two problems this solves for the reply timers:
//  1. Time zones. Database timestamps are UTC instants. If one arrives without a zone
//     marker ("2026-10-17T12:00:00"), JavaScript reads it as the phone's *local* time,
//     which shifts every timer by the phone's UTC offset. We treat zone-less values as UTC.
//  2. Wrong phone clocks. Deadlines are server timestamps plus a window, so "now" must
//     be server time too. We measure how far the phone's clock is from the server's and
//     correct for it.

const HAS_ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

// Parse a timestamp from the database as the UTC instant it represents.
export function parseServerTime(iso: string): Date {
  // Postgres-style "2026-10-17 12:00:00" uses a space; normalise to ISO's "T".
  const trimmed = iso.trim().replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  // Only look for a zone after the time part, so the date's dashes don't count.
  const tIndex = trimmed.indexOf('T');
  if (tIndex === -1) return new Date(trimmed); // date-only strings are already UTC
  return new Date(HAS_ZONE.test(trimmed.slice(tIndex)) ? trimmed : `${trimmed}Z`);
}

let offsetMs = 0;
const listeners = new Set<() => void>();

// The current time according to the server (the phone's clock plus the measured gap).
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}

// Calls fn whenever the measured gap changes; returns an unsubscribe function.
export function onClockSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Round trips slower than this are too imprecise to trust.
const MAX_ROUND_TRIP_MS = 10_000;

// Measure the phone-vs-server gap. `fetchServerTime` returns the server's current
// time as a timestamp, or null if it can't be reached. We assume the server read its
// clock halfway through the round trip. Failure leaves the previous offset untouched.
export async function syncServerClock(
  fetchServerTime: () => Promise<string | null>,
  deviceNow: () => number = Date.now
): Promise<void> {
  const before = deviceNow();
  let stamp: string | null = null;
  try {
    stamp = await fetchServerTime();
  } catch {
    return;
  }
  const after = deviceNow();
  if (!stamp || after - before > MAX_ROUND_TRIP_MS) return;

  const server = parseServerTime(stamp).getTime();
  if (Number.isNaN(server)) return;

  const next = Math.round(server - (before + after) / 2);
  if (next !== offsetMs) {
    offsetMs = next;
    listeners.forEach((fn) => fn());
  }
}

// For tests.
export function resetClockOffset(): void {
  offsetMs = 0;
}
