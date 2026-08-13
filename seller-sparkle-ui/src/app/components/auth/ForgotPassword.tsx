import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import {
  normalizeIndianMobileDigits,
  requiredIndianMobileError,
} from "@/app/helpers/indianMobilePhone";
import {
  applyPasswordPairLiveErrors,
  confirmPasswordError,
  passwordLengthError,
  passwordsMatch,
} from "@/app/helpers/passwordValidation";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { cn } from "@/app/helpers/utils";
import {
  authPortalLoginPath,
  authPortalSignInLabel,
  resolveAuthPortalType,
} from "@/app/helpers/portalHost";

type Mode = "email" | "sms";

type SmsFieldErrors = {
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
};

function maskPhone(national: string): string {
  const digits = national.replace(/\D/g, "");
  if (digits.length < 10) return `+91 ${digits}`;
  return `+91 ${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const portalType = resolveAuthPortalType(searchParams.get("portal"));
  const loginPath = authPortalLoginPath(portalType);
  const signInLabel = authPortalSignInLabel(portalType);
  // Admin accounts are email-only (CEO: no admin phone / SMS).
  const smsAllowed = portalType !== "admin";
  const smsRole: "customer" | "vendor" =
    portalType === "vendor" ? "vendor" : "customer";
  const accountLabel =
    portalType === "vendor" ? "vendor" : portalType === "admin" ? "admin" : "customer";

  const [mode, setMode] = useState<Mode>(() => {
    const method = searchParams.get("method");
    if (method === "sms") return "sms";
    if (method === "email") return "email";
    return portalType === "customer" ? "sms" : "email";
  });
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [smsErrors, setSmsErrors] = useState<SmsFieldErrors>({});
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [smsStep, setSmsStep] = useState<"phone" | "reset">("phone");
  const [cooldown, setCooldown] = useState(0);
  const [smsSuccess, setSmsSuccess] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const pairOk = passwordsMatch(newPassword, confirmPassword);

  const emailSubtitle =
    portalType === "admin"
      ? "Reset your admin password via email link."
      : portalType === "vendor"
        ? "Reset your vendor password via email link."
        : "Use email if your account has an email; use SMS if you registered with a phone.";

  const validateEmail = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address");
      return false;
    }
    setError("");
    return true;
  };

  const validateSmsReset = (): boolean => {
    const next: SmsFieldErrors = {};
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      next.code = "Enter the 6-digit verification code";
    }
    const pwdErr = passwordLengthError(newPassword, {
      shortMessage: "Password must be at least 8 characters",
    });
    if (pwdErr) next.newPassword = pwdErr;
    const confErr = confirmPasswordError(newPassword, confirmPassword);
    if (confErr) next.confirmPassword = confErr;
    setSmsErrors(next);
    return Object.keys(next).length === 0;
  };

  const onNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setSmsErrors((prev) =>
      applyPasswordPairLiveErrors(
        prev,
        value,
        confirmPassword,
        { password: "newPassword", confirm: "confirmPassword" },
        { passwordShortMessage: "Password must be at least 8 characters" },
      ),
    );
  };

  const onConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setSmsErrors((prev) =>
      applyPasswordPairLiveErrors(
        prev,
        newPassword,
        value,
        { password: "newPassword", confirm: "confirmPassword" },
        { passwordShortMessage: "Password must be at least 8 characters" },
      ),
    );
  };

  const handleEmailSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateEmail()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email, portalType);
      setEmailSuccess(true);
      toast.success("If the email exists, a reset link has been sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset link. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSmsOtp = async () => {
    const phoneErr = requiredIndianMobileError(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const normalized = normalizeIndianMobileDigits(phone);
      const res = await authApi.sendForgotPasswordSmsOtp(normalized, smsRole);
      setPhone(normalized);
      setSmsStep("reset");
      setCode("");
      setSmsErrors({});
      setCooldown(45);
      toast.success(res.message || "If an account exists, a code was sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send code.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSmsReset = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateSmsReset()) return;
    setLoading(true);
    try {
      await authApi.resetPasswordWithSmsOtp(phone, code, newPassword, confirmPassword, smsRole);
      setSmsSuccess(true);
      toast.success("Password reset successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password.";
      toast.error(message);
      setSmsErrors((prev) => ({ ...prev, code: message.toLowerCase().includes("code") ? message : prev.code }));
    } finally {
      setLoading(false);
    }
  };

  if (emailSuccess) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent a password reset link to your email."
        portalType={portalType}
      >
        <div className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">
            If the email exists, a reset link has been sent. The link will expire in 15 minutes.
          </p>
          <Button asChild className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11">
            <Link to={loginPath}>{signInLabel}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (smsSuccess) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="You can now sign in with your new password."
        portalType={portalType}
      >
        <div className="space-y-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <Button asChild className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11">
            <Link to={loginPath}>Continue to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const authTitle =
    mode === "sms" && smsStep === "reset" ? "Verify & reset" : "Forgot Password";
  const authSubtitle =
    mode === "email"
      ? emailSubtitle
      : smsStep === "reset"
        ? "Enter the code we sent, then choose a new password."
        : `Reset your ${accountLabel} account with an SMS code.`;

  return (
    <AuthLayout title={authTitle} subtitle={authSubtitle} portalType={portalType}>
      {smsAllowed && !(mode === "sms" && smsStep === "reset") && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1">
          <Button
            type="button"
            variant={mode === "email" ? "default" : "ghost"}
            className="h-9 rounded-lg"
            onClick={() => {
              setMode("email");
              setError("");
              setSmsErrors({});
            }}
          >
            Email
          </Button>
          <Button
            type="button"
            variant={mode === "sms" ? "default" : "ghost"}
            className="h-9 rounded-lg"
            onClick={() => {
              setMode("sms");
              setError("");
              setSmsErrors({});
              setSmsStep("phone");
            }}
          >
            SMS
          </Button>
        </div>
      )}

      {mode === "email" || !smsAllowed ? (
        <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                portalType === "admin"
                  ? "admin@company.com"
                  : portalType === "customer"
                    ? "you@email.com"
                    : "you@company.com"
              }
              aria-invalid={!!error}
              className={error ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      ) : smsStep === "phone" ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" required>
              Mobile number
            </Label>
            <IndianMobileInput id="phone" value={phone} onChange={setPhone} invalid={!!error} />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Use the 10-digit Indian mobile linked to your {accountLabel} account.
              </p>
            )}
          </div>
          <Button
            type="button"
            className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11"
            disabled={loading}
            onClick={() => void handleSendSmsOtp()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Send verification code"
            )}
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSmsReset(e)} className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3 py-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">Verification code sent</p>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-foreground">{maskPhone(phone)}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label required>Verification code</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (smsErrors.code) setSmsErrors((e) => ({ ...e, code: undefined }));
                }}
                containerClassName="gap-2"
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className={cn(
                        "h-12 w-10 rounded-md border text-base shadow-sm sm:h-12 sm:w-11",
                        smsErrors.code && "border-destructive",
                      )}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {smsErrors.code ? (
              <p className="text-center text-xs text-destructive">{smsErrors.code}</p>
            ) : (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={loading || cooldown > 0}
                  onClick={() => void handleSendSmsOtp()}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get a code? Resend"}
                </Button>
              </div>
            )}
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
              <span className="bg-background px-2 text-muted-foreground">New password</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword" required>
              New password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => onNewPasswordChange(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                aria-invalid={!!smsErrors.newPassword}
                className={cn(
                  "pr-10",
                  smsErrors.newPassword && "border-destructive focus-visible:ring-destructive",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {smsErrors.newPassword ? (
              <p className="text-xs text-destructive">{smsErrors.newPassword}</p>
            ) : newPassword.length > 0 && newPassword.length < 8 ? (
              <p className="text-[11px] text-muted-foreground">{newPassword.length}/8 characters</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" required>
              Confirm password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                aria-invalid={!!smsErrors.confirmPassword}
                className={cn(
                  "pr-10",
                  smsErrors.confirmPassword && "border-destructive focus-visible:ring-destructive",
                  pairOk && !smsErrors.confirmPassword && "border-emerald-500/60",
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirmPwd ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPwd ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {smsErrors.confirmPassword ? (
              <p className="text-xs text-destructive">{smsErrors.confirmPassword}</p>
            ) : pairOk ? (
              <p className="text-xs text-emerald-600">Passwords match</p>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11"
            disabled={loading || code.length !== 6 || !pairOk}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
              </>
            ) : (
              "Reset password"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setSmsStep("phone");
              setCode("");
              setNewPassword("");
              setConfirmPassword("");
              setSmsErrors({});
              setError("");
            }}
          >
            Use a different number
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link to={loginPath} className="font-semibold text-primary hover:underline">
          {signInLabel}
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
