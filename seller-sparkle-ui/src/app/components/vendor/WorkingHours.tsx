import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { WorkingHour } from "@/app/models";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

const dayLabels: Record<WorkingHour["day"], string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const orderedDays: WorkingHour["day"][] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayToNumber: Record<WorkingHour["day"], number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
const numberToDay: Record<number, WorkingHour["day"]> = { 0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun" };

const defaultHours: WorkingHour[] = orderedDays.map((day) => ({
  day,
  open: day !== "sun",
  openTime: "09:00",
  closeTime: "18:00",
}));

const toTimeInput = (time?: string): string => {
  if (!time) return "";
  return time.slice(0, 5);
};

const WorkingHours = () => {
  const { user } = useAuth();
  const [hours, setHours] = useState<WorkingHour[]>(defaultHours);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const update = (day: WorkingHour["day"], patch: Partial<WorkingHour>) =>
    setHours((h) => h.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  const saveHours = async () => {
    if (!user) {
      toast.error("Please login again.");
      return;
    }

    try {
      setBusy(true);

      await Promise.all(hours.map((h) => {
        const dayOfWeek = dayToNumber[h.day];
        return vendorOnboardingApi.upsertVendorWorkingHour(user.id, dayOfWeek, {
          vendorId: user.id,
          dayOfWeek,
          isOpen: h.open,
          openTime: h.open ? h.openTime : undefined,
          closeTime: h.open ? h.closeTime : undefined,
        });
      }));

      toast.success("Working hours saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save working hours.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const loadHours = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        const rows = await vendorOnboardingApi.getVendorWorkingHours(user.id);
        if (rows.length === 0) {
          setHours(defaultHours);
          return;
        }

        const mapped = defaultHours.map((d) => {
          const row = rows.find((r) => numberToDay[r.dayOfWeek] === d.day);
          if (!row) return d;
          return {
            day: d.day,
            open: row.isOpen,
            openTime: row.isOpen ? toTimeInput(row.openTime) || d.openTime : d.openTime,
            closeTime: row.isOpen ? toTimeInput(row.closeTime) || d.closeTime : d.closeTime,
          };
        });

        setHours(mapped);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load working hours.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void loadHours();
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Working hours"
        description="Set your weekly schedule. Customers can only place rental requests during your open hours."
        actions={
          <Button onClick={saveHours} className="bg-gradient-primary shadow-glow" disabled={busy}>
            <Save className="mr-2 h-4 w-4" /> Save changes
          </Button>
        }
      />

      {!hasLoaded && busy && (
        <Card className="mb-4 border-border/60 p-4 text-sm text-muted-foreground">Loading working hours...</Card>
      )}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      <Card className="overflow-hidden border-border/60">
        <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
          <div className="col-span-3">Day</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Open</div>
          <div className="col-span-3">Close</div>
          <div className="col-span-1 text-right">Hours</div>
        </div>
        <ul className="divide-y divide-border">
          {hours.map((h) => {
            const totalMin = (() => {
              const [oh, om] = h.openTime.split(":").map(Number);
              const [ch, cm] = h.closeTime.split(":").map(Number);
              return Math.max(0, ch * 60 + cm - (oh * 60 + om));
            })();
            const hrs = (totalMin / 60).toFixed(1);
            return (
              <li key={h.day} className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-12 sm:items-center">
                <div className="col-span-3">
                  <p className="font-semibold">{dayLabels[h.day]}</p>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={h.open} onCheckedChange={(v) => update(h.day, { open: v })} />
                  <span className={`text-sm font-medium ${h.open ? "text-success" : "text-muted-foreground"}`}>
                    {h.open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="col-span-3">
                  <Input type="time" value={h.openTime} onChange={(e) => update(h.day, { openTime: e.target.value })} disabled={!h.open} />
                </div>
                <div className="col-span-3">
                  <Input type="time" value={h.closeTime} onChange={(e) => update(h.day, { closeTime: e.target.value })} disabled={!h.open} />
                </div>
                <div className="col-span-1 text-right text-sm font-semibold text-muted-foreground">
                  {h.open ? `${hrs}h` : "—"}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};

export default WorkingHours;


