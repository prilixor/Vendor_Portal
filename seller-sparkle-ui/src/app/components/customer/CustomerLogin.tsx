import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { getVendorPortalHref } from "@/app/helpers/portalHost";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { customerApi } from "@/app/services/customerApi";
import { authApi } from "@/app/services/authApi";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { isValidIndianMobile, normalizeIndianMobileDigits } from "@/app/helpers/indianMobilePhone";
import { isUnverifiedEmailError } from "@/app/helpers/authFailureToast";

const CustomerLogin = () => {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/customer/shop";
  const { login } = useAuth();
  const vendorLoginHref = getVendorPortalHref("/login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");

  const goAfterAuth = () => {
    window.location.href = from.startsWith("/customer") ? from : "/customer/shop";
  };

  const validate = () => {
    const e: typeof errors = {};
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
    const isPhone = isValidIndianMobile(email);
    if (!isEmail && !isPhone) e.email = "Enter a valid email or 10-digit Indian mobile number";
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors((prev) => ({ ...prev, form: undefined }));
    try {
      const identifier = email.trim();
      await login(identifier, password, "customer");
      setNeedsVerification(false);
      const profile = await customerApi.getProfile();
      const rawPhone = profile.phone?.trim() ?? "";
      if (rawPhone && !profile.isPhoneVerified && isValidIndianMobile(rawPhone)) {
        setPendingPhone(normalizeIndianMobileDigits(rawPhone));
        setOtpOpen(true);
        return;
      }
      toast.success("Welcome!");
      goAfterAuth();
    } catch (error) {
      if (isUnverifiedEmailError(error)) {
        setNeedsVerification(true);
        setErrors((prev) => ({ ...prev, form: undefined }));
        toast.error("Please verify your email before logging in.");
      } else {
        setNeedsVerification(false);
        setErrors((prev) => ({ ...prev, form: "Invalid email/phone or password." }));
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    const candidateEmail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidateEmail)) {
      toast.error("Enter your email address to resend the verification link.");
      return;
    }

    setResendLoading(true);
    try {
      await authApi.resendVerification(candidateEmail, "customer");
      toast.success("Verification link has been resent.");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to resend verification link.";
      message = message.replace(/\n?\[.*?\]/g, "").trim();
      toast.error(message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout title="Customer sign in" subtitle="Browse rentals and manage your orders." portalType="customer">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>Email or Phone Number</Label>
          <Input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com or 9876543210"
            aria-invalid={!!errors.email}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>Password</Label>
            <Link to="/forgot-password?portal=customer" className="text-xs font-medium text-primary hover:underline">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? "border-destructive focus-visible:ring-destructive pr-10" : "pr-10"}
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
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        {errors.form && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errors.form}
          </div>
        )}

        {needsVerification && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
            <p>Your email is not verified yet. Resend the link, then try signing in again.</p>
            <Button
              type="button"
              variant="outline"
              className="w-full h-10"
              disabled={resendLoading}
              onClick={() => void resendVerification()}
            >
              {resendLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending…
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
          </div>
        )}

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New customer?{" "}
        <Link to="/customer/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Vendor?{" "}
        <a href={vendorLoginHref} className="font-medium text-primary hover:underline">
          Vendor sign in
        </a>
      </p>

      <PhoneOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        phone={pendingPhone}
        role="customer"
        required
        onVerified={() => {
          toast.success("Welcome!");
          goAfterAuth();
        }}
      />
    </AuthLayout>
  );
};

export default CustomerLogin;
