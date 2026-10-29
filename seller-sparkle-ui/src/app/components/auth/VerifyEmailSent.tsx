import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  authPortalLoginPath,
  resolveAuthPortalType,
} from "@/app/helpers/portalHost";

const VerifyEmailSent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalType = resolveAuthPortalType(searchParams.get("portal"));
  const loginPath = authPortalLoginPath(portalType);
  const phoneAlreadyVerified =
    portalType === "vendor" && searchParams.get("phoneVerified") === "1";
  const initialEmail = useMemo(() => {
    return searchParams.get("email") || sessionStorage.getItem("pending_verification_email") || "";
  }, [searchParams]);

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resendVerification(
        value,
        portalType === "customer" ? "customer" : portalType === "vendor" ? "vendor" : undefined,
      );
      sessionStorage.setItem("pending_verification_email", value.toLowerCase());
      toast.success("Verification email resent. Check your inbox (and spam).");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend verification email.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={phoneAlreadyVerified ? "Verify your email" : "Verify your email"}
      subtitle={
        phoneAlreadyVerified
          ? "Phone verified. One more step — confirm your email to sign in."
          : "Check your inbox to continue."
      }
      portalType={portalType}
    >
      <div className="space-y-5">
        {phoneAlreadyVerified && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Phone number verified. Open the link we sent to{" "}
              <span className="font-medium">{email || "your email"}</span> to finish signup.
            </p>
          </div>
        )}

        {!phoneAlreadyVerified && (
          <p className="text-center text-sm text-muted-foreground">
            A verification link has been sent to your email. You cannot sign in until it is verified.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <Button
          type="button"
          className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11"
          onClick={() => void resend()}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending…
            </>
          ) : (
            "Resend verification email"
          )}
        </Button>

        <Button type="button" variant="outline" className="w-full h-11" onClick={() => navigate(loginPath)}>
          Go to sign in
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Didn’t get the email? Check spam/junk, then use Resend.
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailSent;
