import { digitsOnly } from "@/app/helpers/indianMobilePhone";

/** Optional clinic contact: Indian mobile or landline with STD. */
export const INDIAN_CONTACT_MESSAGE =
  "Enter a valid Indian mobile (10 digits, starts with 6–9) or landline with STD, e.g. 079-2658-1234.";

const MOBILE = /^[6-9]\d{9}$/;
/** 10-digit landline that already includes a 2-digit metro STD (no leading 0). */
const METRO_STD_LANDLINE = /^(11|20|22|33|40|44|79|80)\d{8}$/;

function stripCountryCode(digits: string): string {
  if (digits.startsWith("91") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

export function normalizeIndianContactDigits(value: string): string {
  const digits = stripCountryCode(digitsOnly(value));
  if (digits.length === 11 && digits.startsWith("0")) {
    const rest = digits.slice(1);
    if (/^(79|80)\d{8}$/.test(rest)) return digits;
    if (MOBILE.test(rest)) return rest;
    return digits;
  }
  if (METRO_STD_LANDLINE.test(digits) && !MOBILE.test(digits)) return `0${digits}`;
  return digits;
}

export function isValidIndianContactNumber(value: string): boolean {
  const digits = stripCountryCode(digitsOnly(value));
  if (MOBILE.test(digits)) return true;
  if (METRO_STD_LANDLINE.test(digits)) return true;
  if (digits.length === 11 && digits.startsWith("0")) {
    const rest = digits.slice(1);
    return MOBILE.test(rest) || /^[1-5]\d{9}$/.test(rest);
  }
  return false;
}

/** Optional field: empty is OK; non-empty must be mobile or landline with STD. */
export function optionalIndianContactError(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  return isValidIndianContactNumber(trimmed) ? null : INDIAN_CONTACT_MESSAGE;
}
