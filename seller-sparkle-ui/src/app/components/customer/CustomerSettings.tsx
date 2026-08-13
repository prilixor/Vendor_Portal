import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import {
  isValidIndianMobile,
  normalizeIndianMobileDigits,
  optionalIndianMobileError,
} from "@/app/helpers/indianMobilePhone";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FieldError } from "@/app/components/shared/FieldError";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { IndianMobileInput } from "@/app/components/shared/IndianMobileInput";
import { PhoneOtpDialog } from "@/app/components/shared/PhoneOtpDialog";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useAuth } from "@/app/guards/AuthContext";
import { authApi } from "@/app/services/authApi";
import { customerApi, type CustomerNotificationPreferenceApi } from "@/app/services/customerApi";
import {
  applyPasswordPairLiveErrors,
  passwordsMatch,
} from "@/app/helpers/passwordValidation";
import { toast } from "sonner";

const CustomerSettings = () => {
  const { user, setSessionUser } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => customerApi.getProfile(),
  });

  const { data: dbPrefs, isLoading: loadingPrefs } = useQuery({
    queryKey: ["customer-preferences"],
    queryFn: () => customerApi.getNotificationPreferences(),
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const hasStoredEmail = !!(data?.email?.trim());
  const emailLocked = hasStoredEmail;
  const emailVerified = !!data?.isEmailVerified;

  useEffect(() => {
    if (data) {
      setFullName(data.fullName);
      setEmail(data.email?.trim() || "");
      setPhone(data.phone ? normalizeIndianMobileDigits(data.phone) : "");
      setPhoneVerified(!!data.isPhoneVerified);
    }
  }, [data]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});

  const clearProfileFieldError = (key: string) => {
    setProfileFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const clearPasswordFieldError = (key: string) => {
    setPasswordFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updatePrefsMut = useMutation({
    mutationFn: (next: Omit<CustomerNotificationPreferenceApi, "customerId">) =>
      customerApi.updateNotificationPreferences(next),
    onSuccess: (updated) => {
      queryClient.setQueryData(["customer-preferences"], updated);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update preferences.");
    },
  });

  const togglePref = (key: keyof Omit<CustomerNotificationPreferenceApi, "customerId">, value: boolean) => {
    if (!dbPrefs) return;
    const next = {
      orderStatusUpdatesEnabled: dbPrefs.orderStatusUpdatesEnabled,
      expirationRemindersEnabled: dbPrefs.expirationRemindersEnabled,
      depositRefundsEnabled: dbPrefs.depositRefundsEnabled,
      directMessagesEnabled: dbPrefs.directMessagesEnabled,
      marketingEmailsEnabled: dbPrefs.marketingEmailsEnabled,
      smsNotificationsEnabled: dbPrefs.smsNotificationsEnabled !== false,
      [key]: value,
    };
    updatePrefsMut.mutate(next);
  };

  const saveProfileMut = useMutation({
    mutationFn: () =>
      customerApi.updateProfile(
        fullName.trim(),
        phone.trim() ? normalizeIndianMobileDigits(phone) : undefined,
        emailLocked ? undefined : email.trim() || undefined,
      ),
    onSuccess: (updated) => {
      const addedEmail = !hasStoredEmail && !!updated.email?.trim();
      toast.success(
        addedEmail
          ? "Profile updated. Check your inbox to verify the new email."
          : "Profile updated.",
      );
      queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
      if (user && updated.email?.trim()) {
        setSessionUser({ ...user, email: updated.email.trim() });
      }
    },
    onError: (err: Error) => {
      const message = err.message || "Failed to update profile.";
      const lower = message.toLowerCase();
      if (
        lower.includes("phone") &&
        (lower.includes("already") || lower.includes("exists") || lower.includes("in use"))
      ) {
        setProfileFieldErrors({ phone: "This phone number is already used by another account." });
      } else if (
        lower.includes("email") &&
        (lower.includes("already") || lower.includes("exists") || lower.includes("in use"))
      ) {
        setProfileFieldErrors({ email: "This email is already used by another account." });
      }
      toast.error(message);
    },
  });

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name.";
    }
    const phoneErr = optionalIndianMobileError(phone);
    if (phoneErr) errors.phone = phoneErr;
    const emailTrimmed = email.trim();
    if (!emailLocked && emailTrimmed && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTrimmed)) {
      errors.email = "Enter a valid email address.";
    }
    if (!phone.trim() && !emailLocked && !emailTrimmed) {
      errors.phone = "Add a phone number, or add an email first.";
    }
    if (!phone.trim() && emailLocked && !hasStoredEmail) {
      errors.phone = "Add a phone number (this account has no email).";
    }
    if (Object.keys(errors).length > 0) {
      setProfileFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }
    setProfileFieldErrors({});
    saveProfileMut.mutate();
  };

  const resendVerificationEmail = async () => {
    const mail = (data?.email || email).trim();
    if (!mail) {
      toast.error("Add and save an email first.");
      return;
    }
    setResendingEmail(true);
    try {
      await authApi.resendVerification(mail, "customer");
      toast.success("Verification email sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setResendingEmail(false);
    }
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    const accountIdentifier =
      (data?.email?.trim() || user?.email?.trim() || data?.phone?.trim() || phone.trim() || "");
    if (!accountIdentifier) {
      toast.error("You must be signed in.");
      return;
    }
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = "Please enter your current password.";
    if (!newPassword) errors.newPassword = "Please enter a new password.";
    else if (newPassword.length < 8) errors.newPassword = "New password must be at least 8 characters.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm your new password.";
    else if (newPassword && newPassword !== confirmPassword) errors.confirmPassword = "New password and confirm password must match.";
    if (Object.keys(errors).length > 0) {
      setPasswordFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }
    setPasswordFieldErrors({});

    try {
      await authApi.changePassword({
        email: accountIdentifier,
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, and preferences.</p>
        </div>
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load profile."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, security, and preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-2xl border-border/60">
            <CardContent className="p-5 sm:p-6">
              {isLoading || !data ? (
                <div className="space-y-4">
                  <Skeleton className="h-5 w-28" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-10 w-28" />
                </div>
              ) : (
                <form onSubmit={saveProfile}>
                  <h2 className="mb-1 text-sm font-semibold">Account</h2>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Fields marked <span className="text-destructive">*</span> are required.
                  </p>
                  <FormGrid cols={2}>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-settings-name" required>Full name</Label>
                      <Input
                        id="customer-settings-name"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          clearProfileFieldError("fullName");
                        }}
                        className={profileFieldErrors.fullName ? "border-destructive" : ""}
                      />
                      <FieldError message={profileFieldErrors.fullName} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-settings-email">Email</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="flex-1 space-y-1.5">
                          <Input
                            id="customer-settings-email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              clearProfileFieldError("email");
                            }}
                            placeholder={emailLocked ? undefined : "you@example.com"}
                            disabled={emailLocked}
                            className={
                              emailLocked
                                ? "bg-muted/50"
                                : profileFieldErrors.email
                                  ? "border-destructive"
                                  : ""
                            }
                          />
                          <FieldError message={profileFieldErrors.email} />
                          {!profileFieldErrors.email && (
                            <p className="text-[11px] text-muted-foreground">
                              {!hasStoredEmail
                                ? "Optional. Add an email to sign in with email/password and receive email alerts. We'll send a verification link."
                                : emailVerified
                                  ? "Verified email on this account."
                                  : "Email added but not verified yet — open the link we sent, or resend."}
                            </p>
                          )}
                        </div>
                        {hasStoredEmail && !emailVerified ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            disabled={resendingEmail}
                            onClick={() => void resendVerificationEmail()}
                          >
                            {resendingEmail ? "Sending…" : "Resend verify"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-settings-phone">Phone</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="flex-1 space-y-1.5">
                          <IndianMobileInput
                            id="customer-settings-phone"
                            value={phone}
                            onChange={(v) => {
                              setPhone(v);
                              setPhoneVerified(false);
                              clearProfileFieldError("phone");
                            }}
                            invalid={!!profileFieldErrors.phone}
                          />
                          <FieldError message={profileFieldErrors.phone} />
                          {!profileFieldErrors.phone && (
                            <p className="text-[11px] text-muted-foreground">
                              {phoneVerified
                                ? "Verified — SMS order updates can be delivered."
                                : "10-digit Indian mobile starting with 6–9. Verify to enable SMS alerts."}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          disabled={!isValidIndianMobile(phone) || phoneVerified}
                          onClick={() => setOtpOpen(true)}
                        >
                          {phoneVerified ? "Verified" : "Verify SMS"}
                        </Button>
                      </div>
                    </div>
                  </FormGrid>
                  <Button type="submit" className="mt-5" disabled={saveProfileMut.isPending}>
                    Save changes
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="max-w-2xl border-border/60">
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={(e) => void updatePassword(e)}>
                <h2 className="mb-1 text-sm font-semibold">Password</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Fields marked <span className="text-destructive">*</span> are required.
                </p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-cur-pw" required>Current password</Label>
                    <div className="relative">
                      <Input
                        id="customer-settings-cur-pw"
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          clearPasswordFieldError("currentPassword");
                        }}
                        autoComplete="current-password"
                        className={
                          passwordFieldErrors.currentPassword
                            ? "border-destructive pr-10"
                            : "pr-10"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      >
                        {showCurrentPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                    <FieldError message={passwordFieldErrors.currentPassword} />
                  </div>
                  <FormGrid cols={2}>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-settings-new-pw" required>New password</Label>
                      <div className="relative">
                        <Input
                          id="customer-settings-new-pw"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNewPassword(value);
                            setPasswordFieldErrors((prev) =>
                              applyPasswordPairLiveErrors(
                                prev,
                                value,
                                confirmPassword,
                                { password: "newPassword", confirm: "confirmPassword" },
                                {
                                  passwordEmptyMessage: "Please enter a new password.",
                                  passwordShortMessage: "New password must be at least 8 characters.",
                                  confirmEmptyMessage: "Please confirm your new password.",
                                  confirmMismatchMessage: "New password and confirm password must match.",
                                },
                              ),
                            );
                          }}
                          autoComplete="new-password"
                          className={
                            passwordFieldErrors.newPassword
                              ? "border-destructive pr-10"
                              : "pr-10"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        >
                          {showNewPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                      <FieldError message={passwordFieldErrors.newPassword} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="customer-settings-cp-pw" required>Confirm</Label>
                      <div className="relative">
                        <Input
                          id="customer-settings-cp-pw"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => {
                            const value = e.target.value;
                            setConfirmPassword(value);
                            setPasswordFieldErrors((prev) =>
                              applyPasswordPairLiveErrors(
                                prev,
                                newPassword,
                                value,
                                { password: "newPassword", confirm: "confirmPassword" },
                                {
                                  passwordEmptyMessage: "Please enter a new password.",
                                  passwordShortMessage: "New password must be at least 8 characters.",
                                  confirmEmptyMessage: "Please confirm your new password.",
                                  confirmMismatchMessage: "New password and confirm password must match.",
                                },
                              ),
                            );
                          }}
                          autoComplete="new-password"
                          className={
                            passwordFieldErrors.confirmPassword
                              ? "border-destructive pr-10"
                              : passwordsMatch(newPassword, confirmPassword)
                                ? "border-emerald-500/60 pr-10"
                                : "pr-10"
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                      <FieldError message={passwordFieldErrors.confirmPassword} />
                      {!passwordFieldErrors.confirmPassword &&
                        passwordsMatch(newPassword, confirmPassword) && (
                          <p className="text-xs text-emerald-600">Passwords match</p>
                        )}
                    </div>
                  </FormGrid>
                </div>
                <Button type="submit" className="mt-5">Update password</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card className="max-w-2xl border-border/60">
            <CardContent className="space-y-3 p-5 sm:p-6">
              {loadingPrefs || !dbPrefs ? (
                <div className="space-y-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <>
                  <PrefRow
                    title="Order Status Updates"
                    desc="Get real-time updates on your orders, deliveries, and returns."
                    checked={dbPrefs.orderStatusUpdatesEnabled}
                    onChange={(v) => togglePref("orderStatusUpdatesEnabled", v)}
                  />
                  <PrefRow
                    title="Expiration Reminders"
                    desc="Receive alerts when your rental period is about to end."
                    checked={dbPrefs.expirationRemindersEnabled}
                    onChange={(v) => togglePref("expirationRemindersEnabled", v)}
                  />
                  <PrefRow
                    title="Deposit & Refund Alerts"
                    desc="Get notified when your security deposits are refunded."
                    checked={dbPrefs.depositRefundsEnabled}
                    onChange={(v) => togglePref("depositRefundsEnabled", v)}
                  />
                  <PrefRow
                    title="Direct Messages"
                    desc="Allow BlinksMed support to contact you directly regarding your rentals."
                    checked={dbPrefs.directMessagesEnabled}
                    onChange={(v) => togglePref("directMessagesEnabled", v)}
                  />
                  <PrefRow
                    title="Marketing Emails"
                    desc="Receive occasional newsletters and promotional offers."
                    checked={dbPrefs.marketingEmailsEnabled}
                    onChange={(v) => togglePref("marketingEmailsEnabled", v)}
                  />
                  {(!phone.trim() || !phoneVerified) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                      {!phone.trim()
                        ? "Add and verify a phone number in Profile to receive SMS alerts."
                        : "Verify your phone number in Profile to enable SMS alerts."}
                    </div>
                  )}
                  <PrefRow
                    title="SMS notifications"
                    desc="Text alerts for order updates (requires a verified phone number)."
                    checked={dbPrefs.smsNotificationsEnabled !== false}
                    onChange={(v) => {
                      if (v && (!phone.trim() || !phoneVerified)) {
                        toast.message(
                          !phone.trim()
                            ? "Add and verify a phone in Profile first."
                            : "Verify your phone in Profile first.",
                        );
                        return;
                      }
                      togglePref("smsNotificationsEnabled", v);
                    }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <PhoneOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        phone={normalizeIndianMobileDigits(phone)}
        role="customer"
        onVerified={() => {
          setPhoneVerified(true);
          queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
        }}
      />
    </div>
  );
};

function PrefRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default CustomerSettings;
