/** Shared password + confirm-password rules for register, reset, and settings. */

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_LENGTH_MESSAGE = "At least 8 characters";
export const PASSWORD_MISMATCH_MESSAGE = "Passwords don't match";
export const PASSWORD_CONFIRM_REQUIRED_MESSAGE = "Please confirm your password";
export const PASSWORDS_MATCH_MESSAGE = "Passwords match";

export type PasswordPairMessages = {
  length?: string;
  mismatch?: string;
  confirmRequired?: string;
};

/** Live: show the length rule only after the user has started typing. */
export function livePasswordLengthError(
  password: string,
  message = PASSWORD_LENGTH_MESSAGE,
): string | undefined {
  if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) return message;
  return undefined;
}

/**
 * Live: mismatch only when confirm is non-empty and the values differ.
 * Identical values never count as a mismatch, even if the password is still too short.
 */
export function liveConfirmPasswordError(
  password: string,
  confirm: string,
  message = PASSWORD_MISMATCH_MESSAGE,
): string | undefined {
  if (confirm.length > 0 && password !== confirm) return message;
  return undefined;
}

export function submitPasswordLengthError(
  password: string,
  message = PASSWORD_LENGTH_MESSAGE,
): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return message;
  return undefined;
}

export function submitConfirmPasswordError(
  password: string,
  confirm: string,
  messages?: Pick<PasswordPairMessages, "mismatch" | "confirmRequired">,
): string | undefined {
  if (!confirm) return messages?.confirmRequired ?? PASSWORD_CONFIRM_REQUIRED_MESSAGE;
  if (password !== confirm) return messages?.mismatch ?? PASSWORD_MISMATCH_MESSAGE;
  return undefined;
}

/** Confirm is complete: both fields filled, long enough, and equal. */
export function passwordsMeetConfirm(password: string, confirm: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    confirm.length > 0 &&
    password === confirm
  );
}

/**
 * Recompute password/confirm errors as the user types, leaving other field errors intact.
 * Clears a pair error as soon as that rule is satisfied (no stale red text).
 */
export function patchLivePasswordPair(
  prev: Record<string, string>,
  password: string,
  confirm: string,
  keys: { password: string; confirm: string },
  messages?: PasswordPairMessages,
): Record<string, string> {
  const next = { ...prev };
  const lengthError = livePasswordLengthError(password, messages?.length);
  if (lengthError) next[keys.password] = lengthError;
  else delete next[keys.password];

  const confirmError = liveConfirmPasswordError(password, confirm, messages?.mismatch);
  if (confirmError) next[keys.confirm] = confirmError;
  else delete next[keys.confirm];

  return next;
}
