/** Indian mobile: 10 digits starting with 6–9. Optional +91 / 91 / 0 prefixes are stripped. */

export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const INDIAN_MOBILE_MESSAGE =
  "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.";

export function digitsOnly(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Strip non-digits and common India prefixes (+91 / 91 / leading 0). */
export function normalizeIndianMobileDigits(value: string): string {
  let digits = digitsOnly(value);
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(normalizeIndianMobileDigits(value));
}

/** Restrict input to 10 digits for phone fields. */
export function maskIndianMobileInput(value: string): string {
  return digitsOnly(value).slice(0, 10);
}

/**
 * Optional field: empty is OK; non-empty must be a valid Indian mobile.
 * Returns error message or null.
 */
export function optionalIndianMobileError(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return isValidIndianMobile(trimmed) ? null : INDIAN_MOBILE_MESSAGE;
}

/**
 * Required field: must be a valid Indian mobile.
 * Returns error message or null.
 */
export function requiredIndianMobileError(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Phone number is required.";
  return isValidIndianMobile(trimmed) ? null : INDIAN_MOBILE_MESSAGE;
}
