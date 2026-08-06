import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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
        className={error ? "border-destructive focus-visible:ring-destructive pr-10" : "pr-10"}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Enter a valid email";
    if (phone.trim().length === 0) {
      e.phone = "Enter a valid phone number";
    } else if (phone.trim().length !== 10) {
      e.phone = "Phone number must be exactly 10 digits";
    }
    if (password.length < 8) e.password = "Use at least 8 characters";
    if (confirm !== password) e.confirm = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(email, password, phone);
      sessionStorage.setItem("pending_verification_email", email.trim().toLowerCase());
      toast.success("Verification link has been sent to your email.");
      navigate("/verify-email-sent");
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
    <AuthLayout title="Create your vendor account" subtitle="Start onboarding in less than 5 minutes.">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <Field id="name" label="Full name" type="text" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="John Doe" error={errors.name} required />
        <Field id="email" label="Work email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@company.com" error={errors.email} required />
        <Field
          id="phone"
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(e: any) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="1234567890"
          error={errors.phone}
          required
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={errors.password}
            required
            show={showPwd}
            onToggle={() => setShowPwd((v) => !v)}
          />
          <PasswordField
            id="confirm"
            label="Confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            error={errors.confirm}
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

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading || !agreed}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
};

export default Register;


