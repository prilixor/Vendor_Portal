import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Headset } from "lucide-react";
import { customerApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/app/helpers/utils";

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
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
  return "bg-muted text-foreground";
}

function formatDetailDate(value?: string | null): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
              <p
                className={cn(
                  "font-medium leading-tight",
                  isUpcoming ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
              {isCurrent && step.key === "active" ? (
                <p className="mt-1 text-xs text-muted-foreground">Current status</p>
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => customerApi.getOrder(orderId!),
    enabled: !!orderId,
  });

  const cancelMut = useMutation({
    mutationFn: () => customerApi.cancelOrder(orderId!),
    onSuccess: () => {
      toast.success("Order cancelled.");
      queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const browseListingTo = `/customer/browse/${encodeURIComponent(data.listingId)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" className="-ml-2 h-auto px-2 text-sm text-muted-foreground hover:text-foreground" asChild>
        <Link to="/customer/orders">← Back to orders</Link>
      </Button>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative min-w-0 flex-1 space-y-2 lg:pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID</p>
                  <h1 className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{data.orderNumber}</h1>
                  <p className="text-sm text-muted-foreground">
                    {data.listingTitle}
                  </p>
                  <Link
                    to={browseListingTo}
                    className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View listing
                  </Link>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm",
                    orderStatusBadgeClass(data.status),
                  )}
                >
                  {data.status}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="text-3xl font-bold tabular-nums tracking-tight">₹{data.totalAmount.toFixed(0)}</p>
              <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                + ₹{data.depositAmount.toFixed(0)} deposit
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <p className="text-lg font-semibold">Order timeline</p>
        </CardHeader>
        <CardContent className="pt-2">
          <OrderTimeline status={data.status} />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <p className="text-lg font-semibold">Rental details</p>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start date</p>
            <p className="text-sm font-medium tabular-nums">{formatDetailDate(data.startDate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End date</p>
            <p className="text-sm font-medium tabular-nums">{formatDetailDate(data.endDate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity</p>
            <p className="text-sm font-medium">{data.quantity}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental days</p>
            <p className="text-sm font-medium">{data.rentalDays}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link
            className="inline-flex items-center"
            to={`/customer/support?order=${encodeURIComponent(data.orderNumber)}`}
          >
            <Headset className="mr-2 h-4 w-4" />
            Contact support
          </Link>
        </Button>
        {data.status.toLowerCase() === "pending" && (
          <Button variant="destructive" disabled={cancelMut.isPending} onClick={() => cancelMut.mutate()}>
            Cancel request
          </Button>
        )}
      </div>
    </div>
  );
};

export default CustomerOrderDetail;
