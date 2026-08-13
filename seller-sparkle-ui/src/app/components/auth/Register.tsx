import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  normalizeIndianMobileDigits,
  requiredIndianMobileError,
} from "@/app/helpers/indianMobilePhone";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import {
  applyPasswordPairLiveErrors,
  confirmPasswordError,
  passwordLengthError,
  passwordsMatch,
} from "@/app/helpers/passwordValidation";
import { cn } from "@/app/helpers/utils";
import { clearImpersonationSession, clearPortalSession } from "@/app/helpers/authSession";

const Field = ({ id, label, type, value, onChange, placeholder, error, required }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} required={required}>{label}</Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-invalid={!!error}
      className={error ? "border-destructive focus-visible:ring-destructive" : ""}
    />
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  successHint,
  required,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  successHint?: string;
  required?: boolean;
  show: boolean;
  onToggle: () => void;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} required={required}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={cn(
          "pr-10",
          error && "border-destructive focus-visible:ring-destructive",
          !error && successHint && "border-emerald-500/60",
        )}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
    {error ? (
      <p className="text-xs text-destructive">{error}</p>
    ) : successHint ? (
      <p className="text-xs text-emerald-600">{successHint}</p>
    ) : hint ? (
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);

const Register = () => {
  const navigate = useNavigate();
  const { register, setSessionUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");

  // Ensure OTP calls stay anonymous even if a prior vendor session is still in the tab.
  useEffect(() => {
    clearImpersonationSession();
    clearPortalSession();
    setSessionUser(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for register hygiene
  }, []);

  const goToEmailVerify = () => {
    const mail = email.trim().toLowerCase();
    sessionStorage.setItem("pending_verification_email", mail);
    toast.success("Phone verified. Next: confirm your email.");
    navigate(`/verify-email-sent?email=${encodeURIComponent(mail)}&portal=vendor&phoneVerified=1`);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Enter a valid email";
    const phoneErr = requiredIndianMobileError(phone);
    if (phoneErr) e.phone = phoneErr;
    const pwdErr = passwordLengthError(password, { shortMessage: "At least 8 characters" });
    if (pwdErr) e.password = pwdErr;
    const confErr = confirmPasswordError(password, confirm);
    if (confErr) e.confirm = confErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
    setErrors((prev) =>
      applyPasswordPairLiveErrors(prev, value, confirm, { password: "password", confirm: "confirm" }),
    );
  };

  const onConfirmChange = (value: string) => {
    setConfirm(value);
    setErrors((prev) =>
      applyPasswordPairLiveErrors(prev, password, value, { password: "password", confirm: "confirm" }),
    );
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const phoneNormalized = normalizeIndianMobileDigits(phone);
      await register(email, password, phoneNormalized);
      setPendingPhone(phoneNormalized);
      setOtpOpen(true);
    } catch (error) {
      let message = error instanceof Error ? error.message : "Registration failed.";
      if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("in use") || message.toLowerCase().includes("taken")) {
        message = "Registration failed. If an account with this email or phone number exists, please try logging in.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your vendor account"
      subtitle="Start onboarding in less than 5 minutes."
      portalType="vendor"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <Field id="name" label="Full name" type="text" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="John Doe" error={errors.name} required />
        <Field id="email" label="Work email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@company.com" error={errors.email} required />
        <div className="space-y-1.5">
          <Label htmlFor="phone" required>Phone number</Label>
          <IndianMobileInput
            id="phone"
            value={phone}
            onChange={setPhone}
            invalid={!!errors.phone}
          />
          {errors.phone ? (
            <p className="text-xs text-destructive">{errors.phone}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              10-digit Indian mobile starting with 6–9.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            error={errors.password}
            hint={password.length > 0 && password.length < 8 ? `${password.length}/8 characters` : undefined}
            required
            show={showPwd}
            onToggle={() => setShowPwd((v) => !v)}
          />
          <PasswordField
            id="confirm"
            label="Confirm"
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder="••••••••"
            error={errors.confirm}
            successHint={passwordsMatch(password, confirm) ? "Passwords match" : undefined}
            required
            show={showConfirmPwd}
            onToggle={() => setShowConfirmPwd((v) => !v)}
          />
        </div>

        <div className="flex items-start space-x-2 py-1">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="terms"
            className="text-xs text-muted-foreground leading-normal font-normal cursor-pointer"
          >
            By creating an account, you agree to our{" "}
            <Link to="/terms-and-conditions" target="_blank" className="text-primary font-medium hover:underline">Terms & Conditions</Link>
            {" "}and{" "}
            <Link to="/privacy-policy" target="_blank" className="text-primary font-medium hover:underline">Privacy Policy</Link>.
          </Label>
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading || !agreed || otpOpen}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>

      <PhoneOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        phone={pendingPhone}
        role="vendor"
        required
        title="Verify your phone"
        description={`Enter the 6-digit code we sent to +91 ${pendingPhone}. After this, we'll ask you to verify your email.`}
        successMessage=""
        onVerified={goToEmailVerify}
      />
    </AuthLayout>
  );
};

export default Register;
