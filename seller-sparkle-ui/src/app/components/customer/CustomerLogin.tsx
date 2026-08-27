import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { getVendorPortalHref, forgotPasswordPath } from "@/app/helpers/portalHost";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const CustomerLogin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: string } | null)?.from ?? "/customer/shop";
  const { login } = useAuth();
  const vendorLoginHref = getVendorPortalHref("/login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!isEmail) e.email = "Enter a valid email address";
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
      await login(email.trim(), password, "customer");
      toast.success("Welcome!");
      navigate(from.startsWith("/customer") ? from : "/customer/shop", { replace: true });
    } catch {
      setErrors((prev) => ({ ...prev, form: "Invalid email or password." }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Customer sign in"
      subtitle="Browse rentals and manage your orders."
      portalType="customer"
      backTo="/customer/shop"
      backLabel="Back to shop"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
            placeholder="you@email.com"
            aria-invalid={!!errors.email}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>Password</Label>
            <Link to={forgotPasswordPath("customer", email)} className="text-xs font-medium text-primary hover:underline">
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

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11 text-white font-semibold" disabled={loading}>
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
    </AuthLayout>
  );
};

export default CustomerLogin;
