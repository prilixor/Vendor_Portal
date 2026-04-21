import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Field = ({ id, label, type, value, onChange, placeholder, error }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
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

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Enter a valid email";
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
      await register(email, password);
      toast.success("Account created! Let's complete your onboarding.");
      navigate("/vendor/onboarding");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your vendor account" subtitle="Start onboarding in less than 5 minutes.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="name" label="Full name" type="text" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="John Doe" error={errors.name} />
        <Field id="email" label="Work email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="you@company.com" error={errors.email} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="password" label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="••••••••" error={errors.password} />
          <Field id="confirm" label="Confirm" type="password" value={confirm} onChange={(e: any) => setConfirm(e.target.value)} placeholder="••••••••" error={errors.confirm} />
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create account"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
};

export default Register;


