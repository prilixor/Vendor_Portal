import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { adminApi, type PlatformSmsSettingsDto } from "@/app/services/adminApi";
import { Loader2, MessageSquare, Save, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

type FlagKey = Exclude<keyof PlatformSmsSettingsDto, "twilioConfigured">;

const CUSTOMER_FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: "customerOrderPlaced", label: "Order placed", hint: "When a customer places a rental/buy request" },
  { key: "customerOrderConfirmed", label: "Vendor confirmed", hint: "When a vendor accepts the order" },
  { key: "customerOrderCancelled", label: "Order cancelled", hint: "Customer or system cancellation" },
  { key: "customerOrderStatusUpdated", label: "Status / delivered", hint: "In transit, delivered/active, returned, reassigned" },
  { key: "customerOrderDispatchFailed", label: "Dispatch failed", hint: "No vendor available / needs re-booking" },
  { key: "customerOrderExpiring", label: "Order expiring", hint: "One reminder when due within 3 days" },
];

const VENDOR_FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: "vendorNewOrder", label: "New order / dispatch offer", hint: "Time-sensitive accept/decline alerts" },
  { key: "vendorAccountApproved", label: "Account approved", hint: "Admin approved vendor account" },
  { key: "vendorAccountRejected", label: "Account rejected", hint: "Admin rejected application" },
  { key: "vendorAccountSuspended", label: "Account suspended", hint: "Temporary suspension" },
  { key: "vendorAccountBanned", label: "Account banned", hint: "Permanent ban" },
  { key: "vendorAccountReactivated", label: "Account reactivated", hint: "Restored after suspend/ban" },
  { key: "vendorBankVerified", label: "Bank verified", hint: "Bank account approved/rejected" },
  { key: "vendorDocumentVerified", label: "Document verified", hint: "KYC document approved/rejected" },
  { key: "vendorServiceAreaUpdated", label: "Service area updated", hint: "Admin set coverage radius" },
];

const defaults: PlatformSmsSettingsDto = {
  transactionalSmsEnabled: false,
  customerOrderPlaced: false,
  customerOrderConfirmed: false,
  customerOrderCancelled: false,
  customerOrderStatusUpdated: false,
  customerOrderDispatchFailed: false,
  customerOrderExpiring: false,
  vendorNewOrder: false,
  vendorAccountApproved: false,
  vendorAccountRejected: false,
  vendorAccountSuspended: false,
  vendorAccountBanned: false,
  vendorAccountReactivated: false,
  vendorBankVerified: false,
  vendorDocumentVerified: false,
  vendorServiceAreaUpdated: false,
  twilioConfigured: false,
};

function FlagRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {label}
          </Label>
          {checked && !disabled ? (
            <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> On
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Off
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export default function AdminSmsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSmsSettingsDto>(defaults);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getPlatformSmsSettings();
      setSettings({ ...defaults, ...data });
    } catch {
      toast.error("Failed to load SMS settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setFlag = (key: FlagKey, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { twilioConfigured: _, ...payload } = settings;
      const saved = await adminApi.updatePlatformSmsSettings(payload);
      setSettings({ ...defaults, ...saved });
      toast.success("SMS settings saved.");
    } catch {
      toast.error("Failed to save SMS settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const masterOff = !settings.transactionalSmsEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SMS / Twilio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control which transactional SMS events the platform may send. Defaults are off.
          Phone OTP for customer/vendor registration and forgot-password always uses Twilio Verify and is not controlled here.
          User preferences and verified phone still apply when an event is enabled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" /> Master switch
          </CardTitle>
          <CardDescription>Turns all transactional SMS below on or off. App setting Twilio:Enabled must also be true.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Twilio Messaging configured:{" "}
              <strong className={settings.twilioConfigured ? "text-emerald-600" : "text-amber-600"}>
                {settings.twilioConfigured ? "Yes" : "No / disabled"}
              </strong>
            </span>
          </div>
          <FlagRow
            id="transactionalSmsEnabled"
            label="Enable transactional SMS"
            hint="When off, no customer/vendor event SMS is sent (OTP still works if Verify is configured)."
            checked={settings.transactionalSmsEnabled}
            onChange={(v) => setFlag("transactionalSmsEnabled", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer events</CardTitle>
          <CardDescription>Order lifecycle and expiration reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {CUSTOMER_FLAGS.map((f) => (
            <FlagRow
              key={f.key}
              id={f.key}
              label={f.label}
              hint={f.hint}
              checked={settings[f.key]}
              disabled={masterOff}
              onChange={(v) => setFlag(f.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendor events</CardTitle>
          <CardDescription>Dispatch offers and account / verification alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {VENDOR_FLAGS.map((f) => (
            <FlagRow
              key={f.key}
              id={f.key}
              label={f.label}
              hint={f.hint}
              checked={settings[f.key]}
              disabled={masterOff}
              onChange={(v) => setFlag(f.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save SMS settings
        </Button>
      </div>
    </div>
  );
}
