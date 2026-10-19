import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { authApi } from "@/app/services/authApi";
import { forgotPasswordPath, getVendorPortalHref } from "@/app/helpers/portalHost";
import { fetchPhoneOtpEnabled } from "@/app/helpers/phoneOtpSetting";
import { cn } from "@/app/helpers/utils";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { maskIndianMobileInput, normalizeIndianMobileDigits, requiredIndianMobileError } from "@/app/helpers/indianMobilePhone";
import { OTP_RESEND_COOLDOWN_SECONDS, parseOtpSendCooldown } from "@/app/helpers/otpSendCooldown";

type SignInMethod = "otp" | "password";

function isUnregisteredOrInvalidPhone(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  if (code === "auth.customer_phone_not_found" || code === "phone.invalid") return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("no customer account found");
}

function MethodSwitch({
  method,
  onChange,
}: {
  method: SignInMethod;
  onChange: (method: SignInMethod) => void;
}) {
  return (
    <div className="mb-4 inline-flex w-full rounded-xl bg-muted p-1" role="tablist" aria-label="Sign in method">
      {([
        ["otp", "OTP"],
        ["password", "Password"],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={method === value}
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
            method === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CustomerLoginFooter({ vendorLoginHref }: { vendorLoginHref: string }) {
  return (
    <>
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
    </>
  );
}

const CustomerLogin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from ?? "/customer/shop";
  const { login, loginWithCustomerPhoneOtp } = useAuth();
  const vendorLoginHref = getVendorPortalHref("/login");

  const [method, setMethod] = useState<SignInMethod>("otp");
  const [phoneOtpEnabled, setPhoneOtpEnabled] = useState<boolean | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});

  const [phone, setPhone] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpErrors, setOtpErrors] = useState<{ phone?: string; form?: string }>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [cooldownPhone, setCooldownPhone] = useState("");

  const goAfterAuth = () => {
    window.location.href = from.startsWith("/customer") ? from : "/customer/shop";
  };

  useEffect(() => {
    let cancelled = false;
    void fetchPhoneOtpEnabled().then((enabled) => {
      if (!cancelled) setPhoneOtpEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handlePasswordSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const next: typeof passwordErrors = {};
    const value = identifier.trim();
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
    const isPhone = requiredIndianMobileError(value) === null && value.replace(/\D/g, "").length > 0;
    if (!isEmail && !isPhone) next.identifier = "Enter a valid email address or 10-digit Indian mobile number";
    if (password.length < 8) next.password = "Password must be at least 8 characters";
    setPasswordErrors(next);
    if (Object.keys(next).length > 0) return;

    setPasswordLoading(true);
    try {
      await login(value, password, "customer");
      toast.success("Welcome!");
      goAfterAuth();
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : "Invalid email/phone or password.";
      setPasswordErrors({ form: message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const goToRegister = (digits: string) => {
    const mobile = maskIndianMobileInput(digits);
    navigate(mobile ? `/customer/register?phone=${encodeURIComponent(mobile)}` : "/customer/register");
  };

  const handleOtpSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const phoneErr = requiredIndianMobileError(phone);
    const national = normalizeIndianMobileDigits(phone);
    if (phoneErr) {
      if (!national) {
        setOtpErrors({ phone: phoneErr });
        return;
      }
      goToRegister(national);
      return;
    }
    if (cooldown > 0) return;

    setOtpLoading(true);
    setOtpErrors({});
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
      if (isUnregisteredOrInvalidPhone(error)) {
        goToRegister(national);
        return;
      }
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not send the code. Try again.";
      setOtpErrors({ form: message });
    } finally {
      setOtpLoading(false);
    }
  };

  const showOtp = phoneOtpEnabled === true;
  const activeMethod: SignInMethod = showOtp ? method : "password";
  const subtitle = activeMethod === "otp"
    ? "Enter your mobile number to sign in, or continue to create an account."
    : "Sign in with your email or mobile number and password.";

  return (
    <AuthLayout
      title="Customer sign in"
      subtitle={phoneOtpEnabled === null ? "Enter your mobile number to sign in, or continue to create an account." : subtitle}
      portalType="customer"
      backTo="/customer/shop"
      backLabel="Back to shop"
    >
      {phoneOtpEnabled === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {showOtp && <MethodSwitch method={method} onChange={setMethod} />}

          {activeMethod === "otp" ? (
            <form onSubmit={(e) => void handleOtpSubmit(e)} className="space-y-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground -mt-1">
                Fields marked <span className="text-destructive">*</span> are required.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="phone" required>Mobile number</Label>
                <IndianMobileInput
                  id="phone"
                  value={phone}
                  onChange={handlePhoneChange}
                  invalid={!!otpErrors.phone}
                  autoComplete="tel-national"
                />
                {otpErrors.phone ? (
                  <p className="text-xs text-destructive">{otpErrors.phone}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    We’ll send a 6-digit OTP to this registered mobile number.
                  </p>
                )}
              </div>

              {otpErrors.form && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {otpErrors.form}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11 text-white font-semibold"
                disabled={otpLoading || cooldown > 0}
              >
                {otpLoading ? (
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
          ) : (
            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground -mt-1">
                Fields marked <span className="text-destructive">*</span> are required.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="customer-login-id" required>Email or mobile number</Label>
                <Input
                  id="customer-login-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  placeholder="you@email.com or 10-digit mobile"
                  className={passwordErrors.identifier ? "border-destructive" : ""}
                />
                {passwordErrors.identifier && <p className="text-xs text-destructive">{passwordErrors.identifier}</p>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customer-login-password" required>Password</Label>
                  <Link to={forgotPasswordPath("customer", identifier)} className="text-xs font-medium text-primary hover:underline">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="customer-login-password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={passwordErrors.password ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.password && <p className="text-xs text-destructive">{passwordErrors.password}</p>}
              </div>
              {passwordErrors.form && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {passwordErrors.form}
                </div>
              )}
              <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11 text-white font-semibold" disabled={passwordLoading}>
                {passwordLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
              </Button>
            </form>
          )}

          <CustomerLoginFooter vendorLoginHref={vendorLoginHref} />

          {showOtp && (
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
          )}
        </>
      )}
    </AuthLayout>
  );
};

export default CustomerLogin;
