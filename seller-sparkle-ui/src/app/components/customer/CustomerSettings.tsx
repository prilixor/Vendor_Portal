import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { useAuth } from "@/app/guards/AuthContext";
import { authApi } from "@/app/services/authApi";
import { customerApi } from "@/app/services/customerApi";
import { toast } from "sonner";

/**
 * Mirrors my-rentals-hub `src/routes/customer._app.settings.tsx` (Lovable).
 * Wired to Vendor Portal APIs: profile GET/PUT, change-password, prefs in localStorage.
 */

const PREFS_STORAGE_KEY = "prilixor.customer.notification_prefs.v1";

type CustomerPrefs = {
  emailUpdates: boolean;
  pushUpdates: boolean;
  marketing: boolean;
};

const defaultPrefs: CustomerPrefs = {
  emailUpdates: true,
  pushUpdates: false,
  marketing: false,
};

function loadPrefs(): CustomerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      emailUpdates: typeof parsed.emailUpdates === "boolean" ? parsed.emailUpdates : defaultPrefs.emailUpdates,
      pushUpdates:
        typeof parsed.pushUpdates === "boolean"
          ? parsed.pushUpdates
          : typeof parsed.pushNotifications === "boolean"
            ? parsed.pushNotifications
            : defaultPrefs.pushUpdates,
      marketing:
        typeof parsed.marketing === "boolean"
          ? parsed.marketing
          : typeof parsed.marketingEmails === "boolean"
            ? parsed.marketingEmails
            : defaultPrefs.marketing,
    };
  } catch {
    return { ...defaultPrefs };
  }
}

function savePrefs(p: CustomerPrefs) {
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(p));
}

const CustomerSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => customerApi.getProfile(),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [prefs, setPrefs] = useState<CustomerPrefs>(defaultPrefs);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  useEffect(() => {
    if (data) {
      setFullName(data.fullName);
      setPhone(data.phone ?? "");
    }
  }, [data]);

  const persistPrefs = (next: CustomerPrefs) => {
    setPrefs(next);
    savePrefs(next);
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
    if (fullName.trim().length < 2) {
      toast.error("Full name is required.");
      return;
    }
    saveProfileMut.mutate();
  };

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error("You must be signed in.");
      return;
    }
    if (!currentPassword || !newPassword) {
      toast.error("Current and new password are required.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password must match.");
      return;
    }

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
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-name">Full name</Label>
                    <Input
                      id="customer-settings-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
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
                <div className="space-y-1.5">
                  <Label htmlFor="customer-settings-cur-pw">Current password</Label>
                  <Input
                    id="customer-settings-cur-pw"
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-new-pw">New password</Label>
                    <Input
                      id="customer-settings-new-pw"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customer-settings-cp-pw">Confirm</Label>
                    <Input
                      id="customer-settings-cp-pw"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
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
              <PrefRow
                title="Email updates"
                desc="Order status, delivery, and returns."
                checked={prefs.emailUpdates}
                onChange={(v) => persistPrefs({ ...prefs, emailUpdates: v })}
              />
              <PrefRow
                title="Push notifications"
                desc="Real-time alerts on your devices."
                checked={prefs.pushUpdates}
                onChange={(v) => persistPrefs({ ...prefs, pushUpdates: v })}
              />
              <PrefRow
                title="Marketing emails"
                desc="Occasional updates about new vendors and offers."
                checked={prefs.marketing}
                onChange={(v) => persistPrefs({ ...prefs, marketing: v })}
              />
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
