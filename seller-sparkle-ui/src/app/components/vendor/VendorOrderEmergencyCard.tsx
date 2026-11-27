import { useQuery } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/helpers/utils";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Shows the customer's equipment emergency on the vendor's order page.
 * Only appears when admin chose to alert vendors. Customer contact details are never shown here.
 */
export function VendorOrderEmergencyCard({ vendorId, orderId }: { vendorId: string; orderId: string }) {
  const { data } = useQuery({
    queryKey: ["vendor-order-emergency", vendorId, orderId],
    queryFn: () => vendorOnboardingApi.getVendorOrderEmergency(vendorId, orderId),
    enabled: Boolean(vendorId && orderId),
    refetchInterval: 15000,
  });

  if (!data) return null;

  const live = data.status === "open" || data.status === "acknowledged";
  const statusText =
    data.status === "open"
      ? "Waiting for BlinksMed to respond"
      : data.status === "acknowledged"
        ? "BlinksMed is handling this"
        : "Resolved";
  const statusTime =
    data.status === "resolved"
      ? formatWhen(data.resolvedAt)
      : data.status === "acknowledged"
        ? formatWhen(data.acknowledgedAt)
        : "";

  return (
    <Card
      className={cn(
        "shadow-sm",
        live
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
          : "border-border/80",
      )}
    >
      <CardContent className="space-y-2 p-4 sm:p-5">
        <p className={cn("flex items-center gap-2 text-sm font-semibold", live && "text-red-900 dark:text-red-100")}>
          <Siren className={cn("h-4 w-4", live ? "text-red-600" : "text-muted-foreground")} />
          Equipment emergency
        </p>
        <p className="text-sm">
          <span className="font-semibold">{data.reasonLabel}</span>
          {data.note ? ` — ${data.note}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Raised {formatWhen(data.createdAt)} · {statusText}
          {statusTime ? ` · ${statusTime}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
