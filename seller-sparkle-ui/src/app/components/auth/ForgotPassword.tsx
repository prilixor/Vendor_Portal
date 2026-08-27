import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  authPortalLoginPath,
  authPortalSignInLabel,
  resolveAuthPortalType,
} from "@/app/helpers/portalHost";

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const portalType = resolveAuthPortalType(searchParams.get("portal"));
  const loginPath = authPortalLoginPath(portalType);
  const signInLabel = authPortalSignInLabel(portalType);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const subtitle =
    portalType === "admin"
      ? "Reset your admin password via email link."
      : portalType === "vendor"
        ? "Reset your vendor password via email link."
        : "Reset your customer password via email link.";

  const emailPlaceholder =
    portalType === "admin"
      ? "admin@company.com"
      : portalType === "customer"
        ? "you@email.com"
        : "you@company.com";

  const validateEmail = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Enter a valid email address");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateEmail()) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email, portalType);
      setSuccess(true);
      toast.success("If the email exists, a reset link has been sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset link. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle={subtitle}
      portalType={portalType}
      backTo={loginPath}
      backLabel="Back to sign in"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={emailPlaceholder}
            aria-invalid={!!error}
            className={error ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : "Send Reset Link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link to={loginPath} className="font-semibold text-primary hover:underline">{signInLabel}</Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
