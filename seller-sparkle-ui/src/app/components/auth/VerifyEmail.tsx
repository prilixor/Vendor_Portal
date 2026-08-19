import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [email, setEmail] = useState(sessionStorage.getItem("pending_verification_email") || "");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing or invalid.");
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);
        setStatus("success");
        setMessage(response.message || "Email verified successfully.");
        toast.success("Email verified successfully.");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Verification failed.";
        setStatus("error");
        setMessage(errorMessage.includes("auth.token_expired") ? "Verification link has expired." : errorMessage);
      }
    };

    void run();
  }, [token]);

  const resend = async () => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setResendLoading(true);
    try {
      await authApi.resendVerification(value);
      sessionStorage.setItem("pending_verification_email", value.toLowerCase());
      toast.success("Verification link has been resent.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to resend verification email.";
      toast.error(errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout title="Email verification" subtitle="We’re checking your link.">
      <div className="space-y-5">
        {status === "loading" && (
          <PageLoaderSlot className="min-h-[10rem] py-0" />
        )}

        {status === "success" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center space-y-3 text-emerald-950">
            <CheckCircle2 className="mx-auto h-10 w-10" />
            <p className="text-sm">{message}</p>
            <Button className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" onClick={() => navigate("/login")}>Go To Login</Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center space-y-3 text-red-950">
              <AlertCircle className="mx-auto h-10 w-10" />
              <p className="text-sm">{message}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            <Button className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" onClick={() => void resend()} disabled={resendLoading}>
              {resendLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending…</> : "Resend Verification Email"}
            </Button>

            <Button variant="outline" className="w-full h-11" asChild>
              <Link to="/login">Go To Login</Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;