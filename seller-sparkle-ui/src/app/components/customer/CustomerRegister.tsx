import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { normalizeIndianMobileDigits, requiredIndianMobileError } from "@/app/helpers/indianMobilePhone";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { cn } from "@/app/helpers/utils";
import { clearImpersonationSession, clearPortalSession } from "@/app/helpers/authSession";

type FieldKey = "fullName" | "email" | "phone" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldKey, string>>;

const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

const CustomerRegister = () => {
  const navigate = useNavigate();
  const { registerCustomer, login, setSessionUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingLoginId, setPendingLoginId] = useState("");

  // Same as vendor register: leftover JWT poisons anonymous phone OTP.
  useEffect(() => {
    clearImpersonationSession();
    clearPortalSession();
    setSessionUser(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const goToShop = () => {
    window.location.href = "/customer/shop";
  };

  const finishAfterPhoneVerified = async () => {
    try {
      const loginId = pendingLoginId || pendingPhone;
      await login(loginId, password, "customer");
      toast.success("Phone verified. Welcome!");
      goToShop();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please sign in to continue.";
      toast.error(message);
      navigate("/customer/login");
    }
  };

  const passwordError = (value: string): string | undefined =>
    value.length < 8 ? "At least 8 characters" : undefined;

  const confirmPasswordError = (pwd: string, confirm: string): string | undefined => {
    if (!confirm) return "Please confirm your password";
    if (confirm !== pwd) return "Passwords don't match";
    return undefined;
  };

  const fieldError = (
    key: FieldKey,
    values?: {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      confirmPassword?: string;
    },
  ): string | undefined => {
    const name = values?.fullName ?? fullName;
    const mail = (values?.email ?? email).trim();
    const mobile = values?.phone ?? phone;
    const pwd = values?.password ?? password;
    const confirm = values?.confirmPassword ?? confirmPassword;

    switch (key) {
      case "fullName":
        return name.trim().length < 2 ? "Enter your full name" : undefined;
      case "email":
        if (mail.length > 0 && !isValidEmail(mail)) return "Valid email required";
        return undefined;
      case "phone":
        return requiredIndianMobileError(mobile) ?? undefined;
      case "password":
        return passwordError(pwd);
      case "confirmPassword":
        return confirmPasswordError(pwd, confirm);
      default:
        return undefined;
    }
  };

  const validateAll = (): boolean => {
    const next: FieldErrors = {};
    (["fullName", "email", "phone", "password", "confirmPassword"] as FieldKey[]).forEach((key) => {
      const err = fieldError(key);
      if (err) next[key] = err;
    });
    setErrors(next);
    setTouched({
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });
    return Object.keys(next).length === 0;
  };

  const updateField = (key: FieldKey, value: string) => {
    if (key === "fullName") setFullName(value);
    if (key === "email") setEmail(value);
    if (key === "phone") setPhone(value);
    if (key === "password") setPassword(value);
    if (key === "confirmPassword") setConfirmPassword(value);

    setTouched((t) => ({ ...t, [key]: true }));

    setErrors((prev) => {
      const next = { ...prev };
      const values =
        key === "fullName"
          ? { fullName: value }
          : key === "email"
            ? { email: value }
            : key === "phone"
              ? { phone: value }
              : key === "password"
                ? { password: value }
                : { confirmPassword: value };

      const err = fieldError(key, values);
      if (err) next[key] = err;
      else delete next[key];

      if (key === "password" && (touched.confirmPassword || prev.confirmPassword || confirmPassword)) {
        const confirmErr = confirmPasswordError(value, confirmPassword);
        if (confirmErr) next.confirmPassword = confirmErr;
        else delete next.confirmPassword;
      }

      return next;
    });
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateAll()) return;
    setLoading(true);
    try {
      const emailTrimmed = email.trim();
      const phoneNormalized = normalizeIndianMobileDigits(phone);
      const hasEmail = isValidEmail(emailTrimmed);

      const result = await registerCustomer(
        hasEmail ? emailTrimmed : null,
        password,
        fullName.trim(),
        phoneNormalized,
      );

      // Phone is required → verify SMS while still anonymous (no JWT), then sign in.
      if (result.requiresPhoneOtp) {
        setPendingPhone(phoneNormalized);
        setPendingLoginId(hasEmail ? emailTrimmed : phoneNormalized);
        setOtpOpen(true);
        return;
      }

      const loginId = hasEmail ? emailTrimmed : phoneNormalized;
      await login(loginId, password, "customer");
      toast.success("Account created.");
      goToShop();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const lower = raw.toLowerCase();
      const isConflict =
        lower.includes("already") ||
        lower.includes("exists") ||
        lower.includes("in use") ||
        lower.includes("taken") ||
        lower.includes("registration failed");
      toast.error(
        isConflict
          ? "Registration failed. If an account with this email or phone number exists, please try logging in."
          : raw || "Registration failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create customer account" subtitle="Rent equipment from verified vendors in one place." portalType="customer">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
        <p className="text-xs text-muted-foreground -mt-1">
          Phone is required for sign in. Email is optional.{" "}
          Fields marked <span className="text-destructive">*</span> are always required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="fullName" required>Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            aria-invalid={!!errors.fullName}
            className={errors.fullName ? "border-destructive" : ""}
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="you@email.com"
            aria-invalid={!!errors.email}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Optional. Used for receipts and account recovery.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone" required>Phone</Label>
          <IndianMobileInput
            id="phone"
            value={phone}
            onChange={(v) => updateField("phone", v)}
            invalid={!!errors.phone}
          />
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Required. You will sign in with this number and an OTP.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" required>Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => updateField("password", e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              className={cn("pr-10", errors.password && "border-destructive")}
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
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password}</p>
          ) : password.length > 0 && password.length < 8 ? (
            <p className="text-[11px] text-muted-foreground">{password.length}/8 characters</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              className={cn(
                "pr-10",
                errors.confirmPassword && "border-destructive",
                !errors.confirmPassword &&
                  confirmPassword.length > 0 &&
                  confirmPassword === password &&
                  "border-emerald-500/60",
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
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          ) : confirmPassword.length > 0 && confirmPassword === password && password.length >= 8 ? (
            <p className="text-xs text-emerald-600">Passwords match</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/customer/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <PhoneOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        phone={pendingPhone}
        role="customer"
        required
        title="Verify your phone"
        description={
          pendingPhone
            ? `Enter the 6-digit code we sent to +91 ${pendingPhone}.`
            : undefined
        }
        successMessage=""
        onVerified={() => void finishAfterPhoneVerified()}
      />
    </AuthLayout>
  );
};

export default CustomerRegister;
