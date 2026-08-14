import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  applyPasswordPairLiveErrors,
  confirmPasswordError,
  passwordLengthError,
  passwordsMatch,
} from "@/app/helpers/passwordValidation";
import { cn } from "@/app/helpers/utils";
import {
  authPortalLoginPath,
  authPortalSignInLabel,
  forgotPasswordPath,
  resolveAuthPortalType,
} from "@/app/helpers/portalHost";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const portalType = resolveAuthPortalType(searchParams.get("portal"));
  const loginPath = authPortalLoginPath(portalType);
  const signInLabel = authPortalSignInLabel(portalType);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    const pwdErr = passwordLengthError(newPassword, {
      shortMessage: "Password must be at least 8 characters",
    });
    if (pwdErr) e.newPassword = pwdErr;
    const confErr = confirmPasswordError(newPassword, confirmPassword);
    if (confErr) e.confirmPassword = confErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setErrors((prev) =>
      applyPasswordPairLiveErrors(prev, value, confirmPassword, {
        password: "newPassword",
        confirm: "confirmPassword",
      }, {
        passwordShortMessage: "Password must be at least 8 characters",
      }),
    );
  };

  const onConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setErrors((prev) =>
      applyPasswordPairLiveErrors(prev, newPassword, value, {
        password: "newPassword",
        confirm: "confirmPassword",
      }, {
        passwordShortMessage: "Password must be at least 8 characters",
      }),
    );
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    if (!token) {
      toast.error("Invalid or missing reset token.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset password. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Invalid Token"
        subtitle="The reset token is missing or invalid."
        portalType={portalType}
      >
        <div className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">
            Please check your email for a valid reset link or request a new one.
          </p>
          <Button asChild className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11">
            <Link to={forgotPasswordPath(portalType)}>Request New Link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        title="Password Reset"
        subtitle="Your password has been successfully reset."
        portalType={portalType}
      >
        <div className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
          <Button asChild className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11">
            <Link to={loginPath}>{signInLabel}</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset Password" subtitle="Enter your new password below." portalType={portalType}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword" required>New Password</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPwd ? "text" : "password"}
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!errors.newPassword}
              className={cn(
                "pr-10",
                errors.newPassword && "border-destructive focus-visible:ring-destructive",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle password visibility"
            >
              {showPwd ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {errors.newPassword ? (
            <p className="text-xs text-destructive">{errors.newPassword}</p>
          ) : newPassword.length > 0 && newPassword.length < 8 ? (
            <p className="text-[11px] text-muted-foreground">{newPassword.length}/8 characters</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => onConfirmChange(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!errors.confirmPassword}
              className={cn(
                "pr-10",
                errors.confirmPassword && "border-destructive focus-visible:ring-destructive",
                passwordsMatch(newPassword, confirmPassword) && !errors.confirmPassword && "border-emerald-500/60",
              )}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle password visibility"
            >
              {showConfirmPwd ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          ) : passwordsMatch(newPassword, confirmPassword) ? (
            <p className="text-xs text-emerald-600">Passwords match</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…</> : "Reset Password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link to={loginPath} className="font-semibold text-primary hover:underline">{signInLabel}</Link>
      </p>
    </AuthLayout>
  );
};

export default ResetPassword;
