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

/* =========================================================================
 * Twilio branch compatible functions & live error helpers
 * ========================================================================= */

export function passwordLengthError(
  password: string,
  options?: { emptyMessage?: string; shortMessage?: string; allowEmpty?: boolean },
): string | undefined {
  const allowEmpty = options?.allowEmpty ?? false;
  if (!password) {
    return allowEmpty ? undefined : (options?.emptyMessage ?? "Please enter a password.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return options?.shortMessage ?? `At least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return undefined;
}

export function confirmPasswordError(
  password: string,
  confirm: string,
  options?: { emptyMessage?: string; mismatchMessage?: string; allowEmpty?: boolean },
): string | undefined {
  const allowEmpty = options?.allowEmpty ?? false;
  if (!confirm) {
    return allowEmpty ? undefined : (options?.emptyMessage ?? "Please confirm your password");
  }
  if (confirm !== password) {
    return options?.mismatchMessage ?? "Passwords don't match";
  }
  return undefined;
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return (
    confirm.length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    confirm === password
  );
}

export function applyPasswordPairLiveErrors<T extends Record<string, string | undefined>>(
  prev: T,
  password: string,
  confirm: string,
  keys: { password: keyof T; confirm: keyof T },
  options?: {
    passwordEmptyMessage?: string;
    passwordShortMessage?: string;
    confirmEmptyMessage?: string;
    confirmMismatchMessage?: string;
  },
): T {
  const next = { ...prev };
  const pwdKey = keys.password;
  const confirmKey = keys.confirm;

  const pwdErr = passwordLengthError(password, {
    emptyMessage: options?.passwordEmptyMessage,
    shortMessage: options?.passwordShortMessage ?? `At least ${MIN_PASSWORD_LENGTH} characters`,
    allowEmpty: !prev[pwdKey] && password.length === 0,
  });
  if (pwdErr) next[pwdKey] = pwdErr as T[keyof T];
  else delete next[pwdKey];

  const confirmWasShown = !!prev[confirmKey] || confirm.length > 0;
  if (confirmWasShown || password.length > 0) {
    const confErr = confirmPasswordError(password, confirm, {
      emptyMessage: options?.confirmEmptyMessage,
      mismatchMessage: options?.confirmMismatchMessage,
      allowEmpty: !prev[confirmKey] && confirm.length === 0,
    });
    if (confErr) next[confirmKey] = confErr as T[keyof T];
    else delete next[confirmKey];
  }

  return next;
}
