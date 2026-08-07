import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Calendar } from "@/app/components/ui/calendar";
import { AvailabilityOverride } from "@/app/models";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

const Availability = () => {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [available, setAvailable] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const dateMap = new Map(overrides.map((o) => [o.date, o]));

  const toUiOverride = (row: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorAvailabilityOverrides>>[number]): AvailabilityOverride => ({
    id: row.id,
    date: row.overrideDate,
    available: row.isAvailable,
    startTime: row.startTime?.slice(0, 5),
    endTime: row.endTime?.slice(0, 5),
    reason: row.reason,
  });

  const add = async () => {
    if (!user) {
      toast.error("Please login again.");
      return;
    }
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    try {
      setBusy(true);
      await vendorOnboardingApi.upsertVendorAvailabilityOverride(user.id, iso, {
        vendorId: user.id,
        overrideDate: iso,
        isAvailable: available,
        startTime: available ? (start || undefined) : undefined,
        endTime: available ? (end || undefined) : undefined,
        reason: reason || undefined,
      });

      const latest = await vendorOnboardingApi.getVendorAvailabilityOverrides(user.id);
      setOverrides(latest.map(toUiOverride));
      setReason("");
      setStart("");
      setEnd("");
      toast.success("Availability override added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save availability override.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmRemove = async (id: string) => {
    if (!user) {
      toast.error("Please login again.");
      return;
    }

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorAvailabilityOverride(user.id, id);
      const latest = await vendorOnboardingApi.getVendorAvailabilityOverrides(user.id);
      setOverrides(latest.map(toUiOverride));
      toast.success("Availability override deleted.");
      setDeleteConfirmId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete availability override.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadOverrides = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        const rows = await vendorOnboardingApi.getVendorAvailabilityOverrides(user.id);
        setOverrides(rows.map(toUiOverride));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load availability overrides.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void loadOverrides();
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Availability overrides"
        description="Block dates for holidays, maintenance, or stocktake — or extend your hours for high-demand dates."
      />

      {!hasLoaded && busy && (
        <div className="space-y-6">
          {/* Calendar Skeleton */}
          <Card className="p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
              {[...Array(35)].map((_, i) => (
                <Skeleton key={`day-${i}`} className="h-10 w-full" />
              ))}
            </div>
          </Card>
          
          {/* Availability Overrides Skeleton */}
          <Card className="p-4">
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-6 lg:p-8 border-border/60">
          <h2 className="mb-4 font-semibold">Pick a date</h2>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-lg border border-border p-3"
              modifiers={{ marked: overrides.map((o) => new Date(o.date)) }}
              modifiersClassNames={{ marked: "bg-primary-soft text-primary font-semibold" }}
            />
          </div>
          {date && dateMap.has(format(date, "yyyy-MM-dd")) && (
            <div className="mt-4 rounded-lg border border-info/20 bg-info-soft p-3 text-xs text-info">
              This date already has an override.
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6 lg:p-8 border-border/60">
          <h2 className="mb-4 font-semibold">Override details</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{available ? "Mark as available" : "Mark as unavailable"}</p>
                <p className="text-xs text-muted-foreground">
                  {available ? "Open during the time range below" : "Block the entire day or time range"}
                </p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start time (optional)</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End time (optional)</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Public holiday" />
            </div>
            <Button onClick={add} className="w-full bg-gradient-primary shadow-glow" disabled={busy}>
              <Plus className="mr-2 h-4 w-4" /> Add override
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6 border-border/60">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Scheduled overrides</h2>
        </div>
        <ul className="divide-y divide-border">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg ${
                  o.available ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
                }`}>
                  <span className="text-[10px] font-bold uppercase">{format(new Date(o.date), "MMM")}</span>
                  <span className="text-base font-bold leading-none">{format(new Date(o.date), "d")}</span>
                </div>
                <div>
                  <p className="font-medium">{o.available ? "Available" : "Unavailable"}{o.startTime && ` · ${o.startTime}–${o.endTime}`}</p>
                  {o.reason && <p className="text-xs text-muted-foreground">{o.reason}</p>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(o.id)} disabled={busy}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
          {hasLoaded && !busy && overrides.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No overrides scheduled yet.</li>
          )}
        </ul>
      </Card>

      {/* Delete Confirmation Card */}
      {deleteConfirmId && (() => {
        const override = overrides.find(o => o.id === deleteConfirmId);
        if (!override) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-card p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Delete Override</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">Are you sure you want to delete this availability override?</p>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium">{format(new Date(override.date), "MMMM d, yyyy")}</p>
                  <p className="text-sm text-muted-foreground">{override.available ? "Available" : "Unavailable"}{override.startTime && ` · ${override.startTime}–${override.endTime}`}</p>
                  {override.reason && <p className="text-sm text-muted-foreground mt-1">{override.reason}</p>}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmRemove(deleteConfirmId)}
                  className="flex-1"
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
};

export default Availability;


