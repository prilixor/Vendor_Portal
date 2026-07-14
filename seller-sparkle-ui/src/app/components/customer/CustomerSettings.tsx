import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FieldError } from "@/app/components/shared/FieldError";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useAuth } from "@/app/guards/AuthContext";
import { authApi } from "@/app/services/authApi";
import { customerApi, type CustomerNotificationPreferenceApi } from "@/app/services/customerApi";
import { toast } from "sonner";

const CustomerSettings = () => {
  const { user } = useAuth();
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
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (data) {
      setFullName(data.fullName);
      setPhone(data.phone ?? "");
    }
  }, [data]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
      [key]: value,
    };
    updatePrefsMut.mutate(next);
  };

  const saveProfileMut = useMutation({
    mutationFn: () => customerApi.updateProfile(fullName.trim(), phone.trim() || undefined),
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name.";
    }
    if (Object.keys(errors).length > 0) {
      setProfileFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }
    setProfileFieldErrors({});
    saveProfileMut.mutate();
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
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
        email: user.email,
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
          <Card>
            <CardContent className="p-5">
              {isLoading || !data ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ) : (
                <form onSubmit={saveProfile} className="space-y-4">
                  <p className="text-xs text-muted-foreground -mt-1">
                    Fields marked <span className="text-destructive">*</span> are required.
                  </p>
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
                    <Input id="customer-settings-email" type="email" value={data.email} disabled className="bg-muted/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-phone">Phone</Label>
                    <Input id="customer-settings-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={saveProfileMut.isPending}>
                    Save changes
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <form className="space-y-4" onSubmit={(e) => void updatePassword(e)}>
                <p className="text-xs text-muted-foreground -mt-1">
                  Fields marked <span className="text-destructive">*</span> are required.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="customer-settings-cur-pw" required>Current password</Label>
                  <Input
                    id="customer-settings-cur-pw"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      clearPasswordFieldError("currentPassword");
                    }}
                    autoComplete="current-password"
                    className={passwordFieldErrors.currentPassword ? "border-destructive" : ""}
                  />
                  <FieldError message={passwordFieldErrors.currentPassword} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-new-pw" required>New password</Label>
                    <Input
                      id="customer-settings-new-pw"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        clearPasswordFieldError("newPassword");
                      }}
                      autoComplete="new-password"
                      className={passwordFieldErrors.newPassword ? "border-destructive" : ""}
                    />
                    <FieldError message={passwordFieldErrors.newPassword} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-cp-pw" required>Confirm</Label>
                    <Input
                      id="customer-settings-cp-pw"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        clearPasswordFieldError("confirmPassword");
                      }}
                      autoComplete="new-password"
                      className={passwordFieldErrors.confirmPassword ? "border-destructive" : ""}
                    />
                    <FieldError message={passwordFieldErrors.confirmPassword} />
                  </div>
                </div>
                <Button type="submit">Update password</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardContent className="space-y-3 p-5">
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
                    desc="Allow vendors to contact you directly regarding your rentals."
                    checked={dbPrefs.directMessagesEnabled}
                    onChange={(v) => togglePref("directMessagesEnabled", v)}
                  />
                  <PrefRow
                    title="Marketing Emails"
                    desc="Receive occasional newsletters and promotional offers."
                    checked={dbPrefs.marketingEmailsEnabled}
                    onChange={(v) => togglePref("marketingEmailsEnabled", v)}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
