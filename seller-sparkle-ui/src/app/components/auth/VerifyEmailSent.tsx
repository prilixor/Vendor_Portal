import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const VerifyEmailSent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      await authApi.resendVerification(value);
      sessionStorage.setItem("pending_verification_email", value.toLowerCase());
      toast.success("Verification link has been resent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend verification email.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle="Check your inbox to continue.">
      <div className="space-y-5">
        <p className="text-center text-sm text-muted-foreground">
          Verification link has been sent to your email.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>

        <Button type="button" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" onClick={() => void resend()} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending…</> : "Resend Verification Email"}
        </Button>

        <Button type="button" variant="outline" className="w-full h-11" onClick={() => navigate("/login")}>
          Go To Login
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Didn’t receive it? Check spam or use the resend button.
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailSent;