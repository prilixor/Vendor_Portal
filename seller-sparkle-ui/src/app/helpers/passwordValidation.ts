/** Shared live validation for password + confirm password fields. */

export const MIN_PASSWORD_LENGTH = 8;

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

/**
 * Live-update password + confirm errors in a form error map.
 * Clears an error when the field becomes valid.
 */
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
    // While typing, empty password only keeps error if it was already shown.
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
