import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorOrderApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";

const TIMELINE_STEPS = [
  { key: "placed", label: "Order Placed" },
  { key: "confirmed", label: "Vendor Confirmed" },
  { key: "out", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "active", label: "Rental Active" },
  { key: "returned", label: "Returned" },
] as const;

function formatDetailDate(value?: string): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function timelineProgress(status: string): { completedThrough: number; currentIndex: number | null } {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  if (compact === "pending") return { completedThrough: 0, currentIndex: 1 };
  if (compact === "confirmed") return { completedThrough: 1, currentIndex: 2 };
  if (compact === "in_transit" || raw.includes("transit")) return { completedThrough: 2, currentIndex: 3 };
  if (compact === "active") return { completedThrough: 4, currentIndex: null };
  if (compact === "returned") return { completedThrough: 5, currentIndex: null };
  return { completedThrough: 0, currentIndex: 1 };
}

function OrderTimeline({ status }: { status: string }) {
  const { completedThrough, currentIndex } = timelineProgress(status);
  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const isDone = i <= completedThrough;
        const isCurrent = currentIndex === i;
        const isUpcoming = !isDone && !isCurrent;
        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {i < TIMELINE_STEPS.length - 1 ? (
              <div
                className={cn(
                  "absolute left-[17px] top-9 h-[calc(100%-0.5rem)] w-px",
                  isDone ? "bg-foreground/25" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
            <div className="relative z-10 flex shrink-0 flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                  isDone && "border-foreground bg-foreground text-background",
                  isCurrent && "border-foreground bg-background text-foreground shadow-sm",
                  isUpcoming && "border-border bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                {isCurrent ? <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden /> : null}
              </div>
            </div>
            <div className="min-w-0 pt-1">
              <p className={cn("font-medium leading-tight", isUpcoming ? "text-muted-foreground" : "text-foreground")}>
                {step.label}
              </p>
              {isCurrent ? <p className="mt-1 text-xs text-muted-foreground">In progress</p> : null}
              {!isCurrent && step.key === "active" && status.trim().toLowerCase() === "active" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Current status</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const VendorOrderDetail = () => {
  const { user } = useAuth();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [order, setOrder] = useState<VendorOrderApiDto | null>(null);

  const loadOrder = async () => {
    if (!user || !orderId) return;
    try {
      setLoading(true);
      const row = await vendorOnboardingApi.getVendorOrder(user.id, orderId);
      setOrder(row);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load order detail.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [user?.id, orderId]);

  const handleStatusChange = async (status: "in_transit" | "active" | "returned") => {
    if (!user || !orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.updateVendorOrderStatus(user.id, orderId, status);
      toast.success("Order status updated.");
      await loadOrder();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status.";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelAssignedVendorOrder(user.id, orderId);
      toast.success("Order cancelled and reassigned.");
      await loadOrder();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel order.";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const normalizedStatus = order?.status.trim().toLowerCase() ?? "";
  const canMarkTransit = normalizedStatus === "confirmed";
  const canMarkActive = normalizedStatus === "in transit" || normalizedStatus === "in_transit";
  const canMarkReturned = normalizedStatus === "active" && order?.orderType.toLowerCase() !== "buy";
  const canCancel = normalizedStatus === "confirmed";

  const nextAction = useMemo(() => {
    if (canMarkReturned) return { label: "Mark returned", action: () => handleStatusChange("returned") };
    if (canMarkActive) return { label: "Mark delivered", action: () => handleStatusChange("active") };
    if (canMarkTransit) return { label: "Mark out for delivery", action: () => handleStatusChange("in_transit") };
    return null;
  }, [canMarkActive, canMarkReturned, canMarkTransit]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 h-auto px-2 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/vendor/orders")}
      >
        ← Back to orders
      </Button>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        {loading || !order ? (
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        ) : (
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="relative min-w-0 flex-1 space-y-2 lg:pr-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID</p>
                    <h1 className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{order.orderNumber}</h1>
                    <p className="text-sm text-muted-foreground">
                      {order.listingTitle} · Qty {order.quantity}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 sm:text-sm dark:bg-emerald-950/40 dark:text-emerald-300">
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <p className="text-3xl font-bold tabular-nums tracking-tight">₹{order.totalAmount.toFixed(2)}</p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">+ Deposit included</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {!loading && order && (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Next step</p>
              <p className="text-sm text-muted-foreground">
                Move this rental forward when you've completed the required operation.
              </p>
            </div>
            {nextAction ? (
              <Button onClick={() => void nextAction.action()} disabled={updating}>
                {nextAction.label}
              </Button>
            ) : (
              <Button variant="outline" disabled>
                No action pending
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && order && (
        <>
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <p className="text-lg font-semibold">Order timeline</p>
            </CardHeader>
            <CardContent className="pt-2">
              <OrderTimeline status={order.status} />
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Customer</p>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</p>
                <p className="text-sm font-medium">{order.customerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery location</p>
                <p className="text-sm font-medium">{order.customerCity ?? "-"}, {order.customerState ?? "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Rental details</p>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start date</p>
                <p className="text-sm font-medium tabular-nums">{formatDetailDate(order.startDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End date</p>
                <p className="text-sm font-medium tabular-nums">{formatDetailDate(order.endDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental days</p>
                <p className="text-sm font-medium">{order.rentalDays}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order type</p>
                <p className="text-sm font-medium uppercase">{order.orderType}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{order.orderType.toUpperCase()}</Badge>
            <Button variant="outline" disabled={!canMarkTransit || updating} onClick={() => void handleStatusChange("in_transit")}>
              Mark In Transit
            </Button>
            <Button variant="outline" disabled={!canMarkActive || updating} onClick={() => void handleStatusChange("active")}>
              Mark Delivered
            </Button>
            <Button variant="outline" disabled={!canMarkReturned || updating} onClick={() => void handleStatusChange("returned")}>
              Mark Returned
            </Button>
            <Button variant="destructive" disabled={!canCancel || updating} onClick={() => void handleCancel()}>
              Cancel & Reassign
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default VendorOrderDetail;
