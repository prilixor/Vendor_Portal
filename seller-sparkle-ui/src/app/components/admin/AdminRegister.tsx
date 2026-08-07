import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/components/layout/AuthLayout";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { adminApi } from "@/app/services/adminApi";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const Field = ({ id, label, type, value, onChange, placeholder, error, disabled = false, required }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} required={required}>{label}</Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-invalid={!!error}
      disabled={disabled}
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
        {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const SelectField = ({ id, label, value, onChange, options, error, required }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} required={required}>{label}</Label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className={`w-full h-10 px-3 py-2 rounded-md border bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const AdminRegister = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [role, setRole] = useState("verifier");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const roleOptions = [
    { value: "super_admin", label: "Super Admin" },
    { value: "verifier", label: "Verifier" },
    { value: "operations_admin", label: "Operations Admin" },
  ];

  const validate = () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Enter a valid email";
    if (password.length < 8) e.password = "Use at least 8 characters";
    if (confirm !== password) e.confirm = "Passwords don't match";
    if (!role) e.role = "Please select a role";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await adminApi.registerAdminUser({
        email,
        password,
        fullName,
        role,
        isActive: true,
      });
      toast.success("Admin account created successfully!");
      navigate("/admin/login");
    } catch (error) {
      let message = error instanceof Error ? error.message : "Registration failed.";
      if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("email already in use")) {
        message = "Registration failed. If an account with this email exists, please try logging in.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create admin account" subtitle="Add a new administrator to the system." portalType="admin">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-1">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <Field
          id="fullName"
          label="Full name"
          type="text"
          value={fullName}
          onChange={(e: any) => setFullName(e.target.value)}
          placeholder="John Doe"
          error={errors.fullName}
          required
        />
        <Field
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e: any) => setEmail(e.target.value)}
          placeholder="admin@company.com"
          error={errors.email}
          required
        />
        <SelectField
          id="role"
          label="Role"
          value={role}
          onChange={(e: any) => setRole(e.target.value)}
          options={roleOptions}
          error={errors.role}
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

        <Button type="submit" className="w-full bg-gradient-primary hover:opacity-95 shadow-glow h-11" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : "Create admin account"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By creating an admin account, you agree to follow the system policies.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an admin account?{" "}
        <Link to="/admin/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
};

export default AdminRegister;
