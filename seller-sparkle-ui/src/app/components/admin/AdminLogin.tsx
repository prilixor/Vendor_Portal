import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { apiClient } from "@/app/services/apiClient";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const response = await apiClient.post<{
        token: string;
        refreshToken?: string;
        user: {
          id: string;
          email: string;
          name?: string;
          fullName?: string;
          role: string;
          adminRole?: string;
          permissions?: string[];
          mustChangePassword?: boolean;
        };
      }>('/auth/login', {
        email,
        password,
        role: 'admin',
      });

      toast.success("Welcome back!");
      localStorage.removeItem("vendor_portal_user");
      const adminUser = {
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName || response.user.name || "Admin",
        name: response.user.name || response.user.fullName || "Admin",
        role: response.user.adminRole || response.user.role,
        adminRole: response.user.adminRole || response.user.role,
        permissions: response.user.permissions ?? [],
        mustChangePassword: !!response.user.mustChangePassword,
      };
      localStorage.setItem("adminUser", JSON.stringify(adminUser));
      // Dedicated admin token — must not share vendor_portal_token with impersonation tabs.
      apiClient.setAdminAuthToken(response.token);
      if (response.refreshToken) {
        localStorage.setItem("vendor_portal_refresh_token", response.refreshToken);
      }
      if (response.user.mustChangePassword) {
        toast.message("Please change your temporary password.");
        window.location.href = "/admin/settings";
      } else {
        window.location.href = "/admin";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Admin Sign In" subtitle="Access the admin dashboard and manage vendors." portalType="admin">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            aria-invalid={!!errors.email}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot?</Link>
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
              {showPwd ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign in as Admin"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Admin accounts are created by a Super Admin from the Admin Users screen.
      </p>
    </AuthLayout>
  );
};

export default AdminLogin;
