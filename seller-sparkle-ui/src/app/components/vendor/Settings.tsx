import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { useAuth } from "@/app/guards/AuthContext";
import { authApi } from "@/app/services/authApi";
import { vendorOnboardingApi, type VendorProfileApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { Eye, EyeOff, Save } from "lucide-react";
import {
  normalizeIndianMobileDigits,
  requiredIndianMobileError,
} from "@/app/helpers/indianMobilePhone";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";

const Settings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VendorProfileApiDto | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const profileRes = await vendorOnboardingApi.getVendorProfile(user.id);
        setProfile(profileRes);
        setFullName(profileRes.ownerName || user.name || "");
        setPhone(profileRes.supportPhone ? normalizeIndianMobileDigits(profileRes.supportPhone) : "");
      } catch {
        setProfile(null);
        setFullName(user.name || "");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    if (!profile) {
      toast.error("Complete onboarding profile first to update settings.");
      return;
    }

    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name (at least 2 characters).";
    }
    const phoneErr = requiredIndianMobileError(phone);
    if (phoneErr) errors.phone = phoneErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    setSavingProfile(true);
    setFieldErrors({});
    try {
      const updated = await vendorOnboardingApi.upsertVendorProfile(user.id, {
        vendorId: user.id,
        businessName: profile.businessName,
        ownerName: fullName.trim(),
        supportPhone: normalizeIndianMobileDigits(phone),
        gstNumber: profile.gstNumber,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
      });

      setProfile(updated);
      setFullName(updated.ownerName || "");
      setPhone(updated.supportPhone ? normalizeIndianMobileDigits(updated.supportPhone) : "");
      toast.success("Profile saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile.";
      toast.error(message);
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

    // Check if user is authenticated
    const token = localStorage.getItem('vendor_portal_token');
    if (!token) {
      toast.error("You are not logged in. Please log in again.");
      return;
    }

    setSavingPassword(true);
    setFieldErrors({});
    try {
      const res = await authApi.changePassword({ email: user?.email ?? "", currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordUpdatedAt(new Date(res.updatedAt).toLocaleString());
      toast.success(res.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update password.";
      if (message.includes("401") || message.includes("Unauthorized")) {
        toast.error("Your session has expired. Please log in again.");
      } else {
        toast.error(message);
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, security, and preferences." />
      {loading ? (
        <div className="space-y-6">
          {/* Settings Skeleton */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-32 mt-5" />
              </Card>

              <Card className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-32 mt-5" />
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 p-4 sm:p-6 lg:p-8">
          <h2 className="mb-1 font-semibold">Account</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <FormGrid cols={2}>
            <div className="space-y-1.5">
              <Label required>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                disabled={loading || savingProfile}
                className={fieldErrors.fullName ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} type="email" disabled />
            </div>
            <div className="space-y-1.5">
              <Label required>Phone</Label>
              <IndianMobileInput
                value={phone}
                onChange={(v) => {
                  setPhone(v);
                  setFieldErrors((prev) => {
                    if (!prev.phone) return prev;
                    const next = { ...prev };
                    delete next.phone;
                    return next;
                  });
                }}
                disabled={loading || savingProfile}
                invalid={!!fieldErrors.phone}
              />
              <FieldError message={fieldErrors.phone} />
              {!fieldErrors.phone && (
                <p className="text-[11px] text-muted-foreground">
                  10-digit Indian mobile starting with 6–9.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Time zone</Label>
              <Input value={timeZone} disabled />
            </div>
          </FormGrid>
          <Button className="mt-5 bg-gradient-primary shadow-glow" onClick={() => void saveProfile()} disabled={loading || savingProfile}>
            <Save className="mr-2 h-4 w-4" /> Save changes
          </Button>
        </Card>
        <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
          <h2 className="mb-1 font-semibold">Security</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Fields marked <span className="text-destructive">*</span> are required.
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
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={savingPassword}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
            <Button variant="outline" className="w-full" onClick={() => void updatePassword()} disabled={savingPassword}>
              Update password
            </Button>
            {passwordUpdatedAt && (
              <p className="text-xs text-muted-foreground text-center">
                Password updated at {passwordUpdatedAt}
              </p>
            )}
          </div>
        </Card>
      </div>
      )}
    </div>
  );
};

export default Settings;


