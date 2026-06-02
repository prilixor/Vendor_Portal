import { useParams, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Headset } from "lucide-react";
import { customerApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/app/helpers/utils";

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (s === "confirmed") {
    return "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  }
  if (s.includes("transit")) {
    return "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
  }
  if (s === "active") {
    return "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white";
  }
  if (s === "returned") {
    return "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
  }
  if (s === "cancelled" || s === "canceled") {
    return "bg-muted text-muted-foreground";
  }
  if (s.includes("dispatch failed")) {
    return "bg-destructive/15 text-destructive dark:bg-destructive/20 dark:text-destructive";
  }
  return "bg-muted text-foreground";
}

function formatDetailDate(value?: string | null): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isCustomerOrderCancellable(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "pending" || s === "awaiting vendor acceptance";
}

const TIMELINE_STEPS = [
  { key: "placed", label: "Order Placed" },
  { key: "confirmed", label: "Vendor Confirmed" },
  { key: "out", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "active", label: "Rental Active" },
  { key: "returned", label: "Returned" },
] as const;

/** Last step index fully completed (inclusive). `currentIndex` is the active step if any. */
function getTimelineProgress(status: string): {
  cancelled: boolean;
  completedThrough: number;
  currentIndex: number | null;
} {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  if (compact === "cancelled" || compact === "canceled") {
    return { cancelled: true, completedThrough: -1, currentIndex: null };
  }
  if (compact === "dispatch_failed" || raw.includes("dispatch failed")) {
    return { cancelled: false, completedThrough: 0, currentIndex: null };
  }
  if (compact === "pending") {
    return { cancelled: false, completedThrough: 0, currentIndex: 1 };
  }
  if (compact === "confirmed") {
    return { cancelled: false, completedThrough: 1, currentIndex: 2 };
  }
  if (compact === "in_transit" || raw.includes("transit")) {
    return { cancelled: false, completedThrough: 2, currentIndex: 3 };
  }
  if (compact === "active") {
    return { cancelled: false, completedThrough: 3, currentIndex: 4 };
  }
  if (compact === "returned") {
    return { cancelled: false, completedThrough: 5, currentIndex: null };
  }
  return { cancelled: false, completedThrough: 0, currentIndex: 1 };
}

function OrderTimeline({ status }: { status: string }) {
  const { cancelled, completedThrough, currentIndex } = getTimelineProgress(status);

  if (cancelled) {
    return (
      <p className="text-sm text-muted-foreground">
        This order was cancelled — steps shown may have completed before cancellation.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const isDone = i <= completedThrough;
        const isCurrent = currentIndex === i;
        const isUpcoming = !isDone && !isCurrent;
        const isRentalActiveCurrent = isCurrent && step.key === "active";

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
                  isRentalActiveCurrent && "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
                  isUpcoming && "border-border bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : null}
                {isCurrent ? <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden /> : null}
              </div>
            </div>
            <div className="min-w-0 pt-1">
              <p
                className={cn(
                  "font-medium leading-tight",
                  isRentalActiveCurrent && "text-emerald-700 dark:text-emerald-300",
                  isUpcoming ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              {isCurrent && step.key === "active" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Rental is currently active</p>
              ) : null}
              {isCurrent && step.key !== "active" ? (
                <p className="mt-1 text-xs text-muted-foreground">In progress</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const CustomerOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Fetch current selected item details
  const currentItemId = selectedItemId || orderId;

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-order", currentItemId],
    queryFn: () => customerApi.getOrder(currentItemId!),
    enabled: !!currentItemId,
  });

  // Fetch all orders to group them locally
  const { data: allOrders } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => customerApi.getOrders(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => customerApi.cancelOrder(id),
    onSuccess: (_, variables) => {
      toast.success("Order cancelled.");
      queryClient.invalidateQueries({ queryKey: ["customer-order", variables] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Find all items belonging to the same order group prefix
  const orderGroupItems = useMemo(() => {
    if (!data || !allOrders) return data ? [data] : [];
    const baseNum = data.orderNumber?.split('-').slice(0, 3).join('-') || "";
    if (!baseNum) return data ? [data] : [];
    const matches = allOrders.filter((o) => o && o.orderNumber && o.orderNumber.split('-').slice(0, 3).join('-') === baseNum);
    return matches.length > 0 ? matches : (data ? [data] : []);
  }, [data, allOrders]);

  // Combined totals for the order group
  const groupTotalAmount = useMemo(() => {
    return orderGroupItems.reduce((sum, item) => sum + (item?.totalAmount ?? 0), 0);
  }, [orderGroupItems]);

  const groupDepositAmount = useMemo(() => {
    return orderGroupItems.reduce((sum, item) => sum + (item?.depositAmount ?? 0), 0);
  }, [orderGroupItems]);

  const baseOrderNumber = useMemo(() => {
    if (!data || !data.orderNumber) return "";
    return data.orderNumber.split('-').slice(0, 3).join('-');
  }, [data]);

  if (!orderId) return <p className="text-sm text-muted-foreground">Missing order.</p>;

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Not found."}</p>
        <Button variant="outline" asChild>
          <Link to="/customer/orders">Back to orders</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const activeItem = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" className="-ml-2 h-auto px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
        <Link to="/customer/orders">← Back to orders</Link>
      </Button>

      {/* Group Master Card */}
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative min-w-0 flex-1 space-y-2 lg:pr-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Group</p>
              <h1 className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{baseOrderNumber}</h1>
              <p className="text-sm text-muted-foreground">
                Consolidated purchase overview
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="text-3xl font-bold tabular-nums tracking-tight">₹{groupTotalAmount.toFixed(0)}</p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                + ₹{groupDepositAmount.toFixed(0)} deposit (Combined)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items in this Order list */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <p className="text-lg font-semibold">Items in this Order</p>
          <p className="text-xs text-muted-foreground">Select an item below to track its individual timeline and details.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderGroupItems.map((item) => {
            const isSelected = item.id === activeItem.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={cn(
                  "w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border transition-all",
                  isSelected
                    ? "bg-accent/40 border-foreground/60 shadow-sm"
                    : "bg-transparent border-border/60 hover:bg-accent/20"
                )}
              >
                <div className="flex items-center gap-3">
                  {item.primaryImageUrl ? (
                    <img src={item.primaryImageUrl} alt={item.listingTitle} className="h-10 w-10 rounded-md object-cover border border-border/40 bg-muted" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-muted border border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">No Img</div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.listingTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.vendorName} · Qty: {item.quantity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                      orderStatusBadgeClass(item.status),
                    )}
                  >
                    {item.status}
                  </span>
                  <span className="font-semibold tabular-nums text-xs sm:w-16 sm:text-right">₹{item.totalAmount.toFixed(0)}</span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Selected Item Timeline */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Order timeline</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tracking: <span className="font-semibold text-foreground">{activeItem.listingTitle}</span></p>
          </div>
          <Button variant="link" className="h-auto p-0 text-xs font-semibold text-primary" asChild>
            <Link to={`/customer/browse/${encodeURIComponent(activeItem.listingId)}`}>
              View listing
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-2">
          <OrderTimeline status={activeItem.status} />
        </CardContent>
      </Card>

      {/* Selected Item Rental Details */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <p className="text-lg font-semibold">Rental details</p>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start date</p>
            <p className="text-sm font-medium tabular-nums">{formatDetailDate(activeItem.startDate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End date</p>
            <p className="text-sm font-medium tabular-nums">{formatDetailDate(activeItem.endDate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity</p>
            <p className="text-sm font-medium">{activeItem.quantity}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental days</p>
            <p className="text-sm font-medium">{activeItem.rentalDays}</p>
          </div>
        </CardContent>
      </Card>

      {/* Support and Cancellation Actions for Selected Item */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link
            className="inline-flex items-center"
            to={`/customer/support?order=${encodeURIComponent(activeItem.orderNumber)}`}
          >
            <Headset className="mr-2 h-4 w-4" />
            Contact support
          </Link>
        </Button>
        {isCustomerOrderCancellable(activeItem.status) && (
          <Button
            variant="destructive"
            disabled={cancelMut.isPending}
            onClick={() => cancelMut.mutate(activeItem.id)}
          >
            Cancel item request
          </Button>
        )}
      </div>
    </div>
  );
};

export default CustomerOrderDetail;

