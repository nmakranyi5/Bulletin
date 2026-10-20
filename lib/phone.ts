// Phone numbers for verification: turning what someone types into the E.164 form ("+15125550123")
// that SMS providers expect, and showing it back nicely.

// Accepts "(512) 555-0123", "512-555-0123", "1 512 555 0123" and "+44 20 7946 0958".
// Numbers without a "+" are treated as US/Canada. Returns null when it can't be a real number.
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) {
    // International: country code + number, 8 to 15 digits in total, no leading zero.
    return digits.length >= 8 && digits.length <= 15 && digits[0] !== '0' ? `+${digits}` : null;
  }

  const national = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  // North American numbers: 10 digits, area code and exchange can't start with 0 or 1.
  if (national.length !== 10 || /^[01]/.test(national) || /^\d{3}[01]/.test(national)) return null;
  return `+1${national}`;
}

// "+15125550123" -> "(512) 555-0123"; other countries are shown as-is.
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// A code as typed: digits only, at most six (what Supabase sends by default).
export const OTP_LENGTH = 6;
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

// Turns the provider's error into something a person can act on.
export function phoneErrorMessage(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('sms') && (m.includes('provider') || m.includes('send'))) {
    return "Text messages aren't set up for this app yet, so we can't send a code right now.";
  }
  if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
    return 'That number is already used by another account.';
  }
  if (m.includes('security purposes') || m.includes('rate limit') || m.includes('too many')) {
    return 'Too many tries. Wait a minute and try again.';
  }
  if (m.includes('expired') || m.includes('invalid')) {
    return 'That code is wrong or has expired. Check it, or send a new one.';
  }
  return message || 'Something went wrong. Try again.';
}
