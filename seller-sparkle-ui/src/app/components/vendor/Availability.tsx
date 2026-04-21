import { useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Calendar } from "@/app/components/ui/calendar";
import { mockOverrides } from "@/app/services/mockData";
import { AvailabilityOverride } from "@/app/models";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const Availability = () => {
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>(mockOverrides);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [available, setAvailable] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const dateMap = new Map(overrides.map((o) => [o.date, o]));

  const add = () => {
    if (!date) return;
    const iso = format(date, "yyyy-MM-dd");
    const ov: AvailabilityOverride = {
      id: `ov${Date.now()}`,
      date: iso,
      available,
      startTime: start || undefined,
      endTime: end || undefined,
      reason: reason || undefined,
    };
    setOverrides((o) => [...o.filter((x) => x.date !== iso), ov]);
    setReason("");
    setStart("");
    setEnd("");
    toast.success("Availability override added");
  };

  const remove = (id: string) => setOverrides((o) => o.filter((x) => x.id !== id));

  return (
    <div>
      <PageHeader
        title="Availability overrides"
        description="Block dates for holidays, maintenance, or stocktake — or extend your hours for high-demand dates."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5 border-border/60">
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

        <Card className="p-5 border-border/60">
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
            <Button onClick={add} className="w-full bg-gradient-primary shadow-glow">
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
              <Button variant="ghost" size="icon" onClick={() => remove(o.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default Availability;


