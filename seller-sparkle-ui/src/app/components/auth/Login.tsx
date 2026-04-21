import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Role } from "@/app/models";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("vendor");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Enter a valid email address";
    if (password.length < 8) e.password = "Password must be at least 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email, password, role);
      toast.success(`Welcome back, ${role === "admin" ? "Admin" : "Vendor"}!`);
      navigate(role === "admin" ? "/admin" : "/vendor");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your workspace.">
      {/* Role toggle */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {(["vendor", "admin"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-all ${
              role === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {r === "vendor" ? "Vendor" : "Admin"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" className="text-xs font-medium text-primary hover:underline">Forgot?</button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              className={errors.password ? "border-destructive focus-visible:ring-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle password visibility"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to the platform?{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link>
      </p>

    </AuthLayout>
  );
};

export default Login;


