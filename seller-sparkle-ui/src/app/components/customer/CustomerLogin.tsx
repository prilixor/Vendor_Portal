import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { getVendorPortalHref } from "@/app/helpers/portalHost";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authApi } from "@/app/services/authApi";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import { normalizeIndianMobileDigits, requiredIndianMobileError } from "@/app/helpers/indianMobilePhone";
import { OTP_RESEND_COOLDOWN_SECONDS, parseOtpSendCooldown } from "@/app/helpers/otpSendCooldown";

const CustomerLogin = () => {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/customer/shop";
  const { loginWithCustomerPhoneOtp } = useAuth();
  const vendorLoginHref = getVendorPortalHref("/login");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; form?: string }>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [cooldownPhone, setCooldownPhone] = useState("");

  const goAfterAuth = () => {
    window.location.href = from.startsWith("/customer") ? from : "/customer/shop";
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const startCooldown = (seconds: number, national: string) => {
    setCooldownPhone(national);
    setCooldown(seconds);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    const national = normalizeIndianMobileDigits(value);
    if (cooldownPhone && national !== cooldownPhone) {
      setCooldown(0);
      setCooldownPhone("");
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const phoneErr = requiredIndianMobileError(phone);
    if (phoneErr) {
      setErrors({ phone: phoneErr });
      return;
    }
    if (cooldown > 0) return;

    const national = normalizeIndianMobileDigits(phone);
    setLoading(true);
    setErrors({});
    try {
      await authApi.sendCustomerLoginOtp(national);
      startCooldown(OTP_RESEND_COOLDOWN_SECONDS, national);
      setPendingPhone(national);
      setOtpOpen(true);
    } catch (error) {
      const wait = parseOtpSendCooldown(error);
      if (wait) {
        startCooldown(wait, national);
        return;
      }
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "No customer account found for this mobile number.";
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

    return (
    <AuthLayout title="Customer sign in" subtitle="Enter your mobile number to receive a one-time code." portalType="customer">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="phone" required>Mobile number</Label>
          <IndianMobileInput
            id="phone"
            value={phone}
            onChange={handlePhoneChange}
            invalid={!!errors.phone}
            autoComplete="tel-national"
          />
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              We’ll send a 6-digit OTP to this registered mobile number.
            </p>
          )}
        </div>

        {errors.form && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errors.form}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11"
          disabled={loading || cooldown > 0}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…
            </>
          ) : cooldown > 0 ? (
            `Send OTP in ${cooldown}s`
          ) : (
            "Send OTP"
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
        skipAutoSend
        title="Enter verification code"
        description={`Enter the 6-digit code sent to +91 ${pendingPhone}.`}
        successMessage=""
        sendOtp={(p) => authApi.sendCustomerLoginOtp(p)}
        verifyOtp={async (p, code) => {
          await loginWithCustomerPhoneOtp(p, code);
        }}
        onVerified={() => {
          toast.success("Welcome!");
          goAfterAuth();
        }}
      />
    </AuthLayout>
  );
};

export default CustomerLogin;
