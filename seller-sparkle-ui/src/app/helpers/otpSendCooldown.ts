/** Matches backend TwilioOptions.OtpResendCooldownSeconds (default 45). */
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

const WAIT_SECONDS_RE = /(\d+)\s*seconds?/i;

export function otpCooldownMessage(seconds: number): string {
  const n = Math.max(1, Math.ceil(seconds));
  return n === 1
    ? "You can request a new code in 1 second."
    : `You can request a new code in ${n} seconds.`;
}

/** Remaining wait when send-OTP was rate-limited; otherwise null. */
export function parseOtpSendCooldown(error: unknown): number | null {
  const err = error as { message?: string; code?: string } | null;
  const message = (err?.message ?? "").trim();
  const code = (err?.code ?? "").trim().toLowerCase();
  const fromMessage = message.match(WAIT_SECONDS_RE);
  const seconds = fromMessage ? Number(fromMessage[1]) : NaN;
  const isRateLimit =
    code === "phone.otp_rate_limited" ||
    /you can request a new code/i.test(message) ||
    /before requesting another code/i.test(message);
  if (!isRateLimit) return null;
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  return OTP_RESEND_COOLDOWN_SECONDS;
}
