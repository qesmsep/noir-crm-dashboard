/**
 * Phone helpers for the reservation-guests feature and the reservation
 * campaign sender.
 *
 * `members.phone` is stored in several formats (+19135551234, 9135551234,
 * (913) 555-1234 ...), so matching across tables is done on the last 10 digits
 * and anything we store ourselves is E.164.
 */

/**
 * Normalize a phone number to E.164. US numbers are the default (+1).
 * Returns null for anything that is not a plausible phone number.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Letters (other than an "ext" suffix we don't support) mean junk input.
  if (/[a-z]/i.test(trimmed)) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (hasPlus) {
    // Explicit international number: 8–15 digits, no leading zero (E.164).
    if (digits.length < 8 || digits.length > 15 || digits.startsWith('0')) return null;
    if (digits.startsWith('1') && digits.length !== 11) return null;
    if (digits.startsWith('1') && !isValidNanp(digits.slice(1))) return null;
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return isValidNanp(digits) ? `+1${digits}` : null;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return isValidNanp(digits.slice(1)) ? `+${digits}` : null;
  }
  return null;
}

/** NANP: area code and exchange can't start with 0 or 1. */
function isValidNanp(ten: string): boolean {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten);
}

/** Last 10 digits of a phone number, or null when there are fewer than 10. */
export function last10(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** "***-1234" style mask for showing an existing number without exposing it. */
export function maskPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `•••-${digits.slice(-4)}` : '••••';
}

/** Pretty US display: (913) 555-1234. Falls back to the input. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  const ten = last10(raw);
  if (!ten) return String(raw ?? '');
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
