import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { authApi } from "@/app/services/authApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

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
      await authApi.forgotPassword(email);
      setSuccess(true);
      toast.success("If the email exists, a reset link has been sent.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send reset link. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title="Check your email" subtitle="We've sent a password reset link to your email.">
        <div className="space-y-6">
          <p className="text-center text-sm text-muted-foreground">
            If the email exists, a reset link has been sent. The link will expire in 15 minutes.
          </p>
          <Button asChild className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11">
            <Link to="/login">Back to Login</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot Password" subtitle="Enter your email to receive a password reset link.">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="you@company.com"
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
        <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
