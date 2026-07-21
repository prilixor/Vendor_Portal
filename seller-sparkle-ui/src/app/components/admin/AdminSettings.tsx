import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { useAuth } from "@/app/guards/AuthContext";
import { adminApi } from "@/app/services/adminApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, Save } from "lucide-react";

const AdminSettings = () => {
  const { user, setSessionUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setFullName(user.name || "");
    setEmail(user.email || "");
  }, [user]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getPasswordStrength = (password: string): { label: "weak" | "medium" | "strong"; cls: string } => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (score >= 4) return { label: "strong", cls: "text-success" };
    if (score >= 2) return { label: "medium", cls: "text-warning" };
    return { label: "weak", cls: "text-destructive" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const saveProfile = async () => {
    if (!user) return;
    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = "Please enter your name (at least 2 characters).";
    }
    if (!email.trim()) {
      errors.email = "Please enter an email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    setSavingProfile(true);
    setFieldErrors({});
    try {
      const updated = await adminApi.updateOwnAdminProfile({
        fullName: fullName.trim(),
        email: email.trim(),
      });
      setFullName(updated.fullName);
      setEmail(updated.email);
      setSessionUser({
        ...user,
        name: updated.fullName,
        email: updated.email,
      });
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) {
      errors.currentPassword = "Please enter your current password.";
    }
    if (!newPassword) {
      errors.newPassword = "Please enter a new password.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters.";
    }
    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (newPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = "New password and confirm password must match.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    setSavingPassword(true);
    setFieldErrors({});
    try {
      await adminApi.updateOwnAdminProfile({
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordUpdatedAt(new Date().toLocaleString());
      if (user) {
        setSessionUser({ ...user });
      }
      // Clear must-change flag from local session after successful password update
      try {
        const raw = localStorage.getItem("adminUser");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          parsed.mustChangePassword = false;
          localStorage.setItem("adminUser", JSON.stringify(parsed));
        }
      } catch {
        /* ignore */
      }
      toast.success("Password updated.");
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Update your profile and password. Role and active status are managed separately."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Settings" },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/60 p-4 sm:p-6 lg:col-span-2 lg:p-8">
          <h2 className="mb-1 font-semibold">Profile</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <FormGrid cols={2}>
            <div className="space-y-1.5">
              <Label required>Name</Label>
              <Input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                disabled={savingProfile}
                className={fieldErrors.fullName ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="space-y-1.5">
              <Label required>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                disabled={savingProfile}
                className={fieldErrors.email ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input
                value={user?.adminRole?.replace(/_/g, " ") ?? user?.role ?? "admin"}
                disabled
                className="capitalize"
              />
            </div>
          </FormGrid>
          <Button
            className="mt-5 bg-gradient-primary shadow-glow"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
          >
            {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save profile
          </Button>
        </Card>

        <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" /> Security
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Change your sign-in password. Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label required>Current password</Label>
              <div className="flex gap-2">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    clearFieldError("currentPassword");
                  }}
                  disabled={savingPassword}
                  className={fieldErrors.currentPassword ? "border-destructive" : ""}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError message={fieldErrors.currentPassword} />
            </div>
            <div className="space-y-1.5">
              <Label required>New password</Label>
              <div className="flex gap-2">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearFieldError("newPassword");
                  }}
                  disabled={savingPassword}
                  className={fieldErrors.newPassword ? "border-destructive" : ""}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError message={fieldErrors.newPassword} />
              {!fieldErrors.newPassword && newPassword.length > 0 && (
                <p className={`text-xs ${passwordStrength.cls}`}>
                  Password strength: {passwordStrength.label}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label required>Confirm password</Label>
              <div className="flex gap-2">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError("confirmPassword");
                  }}
                  disabled={savingPassword}
                  className={fieldErrors.confirmPassword ? "border-destructive" : ""}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void updatePassword()}
              disabled={savingPassword}
            >
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update password
            </Button>
            {passwordUpdatedAt && (
              <p className="text-center text-xs text-muted-foreground">
                Password updated at {passwordUpdatedAt}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
