import { useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { mockWorkingHours } from "@/app/services/mockData";
import { WorkingHour } from "@/app/models";
import { toast } from "sonner";
import { Save } from "lucide-react";

const dayLabels: Record<WorkingHour["day"], string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const WorkingHours = () => {
  const [hours, setHours] = useState<WorkingHour[]>(mockWorkingHours);

  const update = (day: WorkingHour["day"], patch: Partial<WorkingHour>) =>
    setHours((h) => h.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  return (
    <div>
      <PageHeader
        title="Working hours"
        description="Set your weekly schedule. Customers can only place rental requests during your open hours."
        actions={
          <Button onClick={() => toast.success("Working hours saved")} className="bg-gradient-primary shadow-glow">
            <Save className="mr-2 h-4 w-4" /> Save changes
          </Button>
        }
      />

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


