import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { toast } from "sonner";
import { customerApi, type EquipmentEmergencyApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";

const REASONS: { id: string; label: string }[] = [
  { id: "will_not_start", label: "Will not start" },
  { id: "alarm", label: "Alarm" },
  { id: "leak_or_pressure", label: "Leak or pressure" },
  { id: "power", label: "Power" },
  { id: "setup_help", label: "Need help with setup" },
  { id: "patient_unsafe", label: "Patient is unsafe" },
];

function isDelivered(status: string) {
  const compact = status.trim().toLowerCase().replace(/\s+/g, "_");
  return compact === "active" || compact === "delivered";
}

export function CustomerEquipmentEmergency({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].id);
  const [note, setNote] = useState("");
  const delivered = isDelivered(status);

  const { data } = useQuery({
    queryKey: ["customer-equipment-emergency", orderId],
    queryFn: () => customerApi.getEquipmentEmergency(orderId),
    enabled: delivered && !!orderId,
    // Keep checking while an emergency is live so the customer sees when BlinksMed picks it up.
    refetchInterval: (query) => {
      const state = query.state.data?.emergency?.status;
      return state === "open" || state === "acknowledged" ? 10000 : false;
    },
  });

  const raise = useMutation({
    mutationFn: () => customerApi.raiseEquipmentEmergency(orderId, { reason, note: note.trim() || undefined }),
    onSuccess: async (saved: EquipmentEmergencyApi) => {
      setOpen(false);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["customer-equipment-emergency", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["customer-notifications"] });
      toast.success(saved.status === "open" ? "Emergency sent to BlinksMed." : "Emergency updated.");
    },
    onError: (err: Error) => toast.error(err.message || "Could not send the emergency."),
  });

  if (!delivered || !data?.eligible) return null;

  const current = data.emergency;
  const waiting = current?.status === "open";
  const inProgress = current?.status === "acknowledged";

  return (
    <>
      {inProgress ? (
        <Card className="border-amber-300 bg-amber-50 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">BlinksMed received your emergency</p>
            <p className="text-sm text-amber-950/80 dark:text-amber-100/80">
              {current?.reasonLabel}. Our team has seen it
              {current?.acknowledgedAt ? ` at ${new Date(current.acknowledgedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
              {" "}and is working on it. If the patient is in danger, call 108 or 112.
            </p>
          </CardContent>
        </Card>
      ) : waiting ? (
        <Card className="border-red-300 bg-red-50 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="space-y-1 p-3 sm:p-4">
            <p className="text-sm font-semibold text-red-950 dark:text-red-100">Emergency sent to BlinksMed</p>
            <p className="text-sm text-red-950/80 dark:text-red-100/80">
              {current?.reasonLabel}. An admin can see this now. This is an equipment alert. If the patient is in danger, call 108 or 112.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="destructive"
          className="w-full sm:w-auto"
          onClick={() => setOpen(true)}
        >
          <Siren className="mr-2 h-4 w-4" />
          Emergency
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Equipment emergency</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            If the patient is in danger, call 108 or 112 first. This button tells BlinksMed the equipment has a problem. It does not send an ambulance.
          </p>
          <div className="space-y-2">
            <Label>What is wrong?</Label>
            <div className="grid gap-2">
              {REASONS.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="emergency-reason"
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergency-note">Note (optional)</Label>
            <Textarea
              id="emergency-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alarm code, what you already tried"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={raise.isPending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={raise.isPending} onClick={() => raise.mutate()}>
              {raise.isPending ? "Sending…" : "Send emergency"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
