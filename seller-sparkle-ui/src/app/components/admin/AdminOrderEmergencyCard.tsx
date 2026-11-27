import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type EquipmentEmergencyDto } from "@/app/services/adminApi";
import { ADMIN_EMERGENCIES_QUERY_KEY } from "@/app/components/admin/AdminEmergencyAlert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/helpers/utils";

function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusLine(item: EquipmentEmergencyDto) {
  if (item.status === "open") return "Waiting for acknowledge";
  if (item.status === "acknowledged") return `Acknowledged ${formatWhen(item.acknowledgedAt)} · working on it`;
  return `Resolved ${formatWhen(item.resolvedAt)}`;
}

/** Equipment emergencies for one order on the admin order page, with Acknowledge and Resolve. */
export function AdminOrderEmergencyCard({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin-order-emergencies", orderId] as const;

  const { data } = useQuery({
    queryKey,
    queryFn: () => adminApi.getOrderEquipmentEmergencies(orderId, { quiet: true }),
    enabled: Boolean(orderId),
    refetchInterval: 10000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ADMIN_EMERGENCIES_QUERY_KEY });
  };

  const acknowledge = useMutation({
    mutationFn: (id: string) => adminApi.acknowledgeEquipmentEmergency(id),
    onSuccess: refresh,
    onError: (err: Error) => toast.error(err.message || "Could not acknowledge the emergency."),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => adminApi.resolveEquipmentEmergency(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Emergency marked resolved. The customer has been told.");
    },
    onError: (err: Error) => toast.error(err.message || "Could not resolve the emergency."),
  });

  const items = data ?? [];
  if (items.length === 0) return null;
  const busy = acknowledge.isPending || resolve.isPending;
  const hasLive = items.some((item) => item.status === "open" || item.status === "acknowledged");

  return (
    <Card className={cn("shadow-sm", hasLive ? "border-red-300 dark:border-red-900" : "border-border/80")}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Siren className={cn("h-4 w-4", hasLive ? "text-red-600" : "text-muted-foreground")} />
          Equipment emergency
        </p>
        {items.map((item) => {
          const open = item.status === "open";
          const acknowledged = item.status === "acknowledged";
          return (
            <div
              key={item.id}
              className={cn(
                "space-y-2 rounded-lg border p-3 text-sm",
                open && "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
                acknowledged && "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
                !open && !acknowledged && "border-border",
              )}
            >
              <p className="font-semibold">
                {item.reasonLabel}
                {item.note ? ` — ${item.note}` : ""}
              </p>
              <p className="text-muted-foreground">
                Customer: {item.customerName}
                {item.customerPhone ? ` · ${item.customerPhone}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Raised {formatWhen(item.createdAt)} · {statusLine(item)}
                {item.vendorNotified ? " · Vendor bell sent" : ""}
              </p>
              {(open || acknowledged) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {open && (
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => acknowledge.mutate(item.id)}>
                      Acknowledge
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={open ? "outline" : "default"}
                    disabled={busy}
                    onClick={() => resolve.mutate(item.id)}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
