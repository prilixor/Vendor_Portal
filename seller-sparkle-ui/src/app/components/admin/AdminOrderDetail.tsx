import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Building, Calendar, DollarSign, Package, User } from "lucide-react";
import { adminApi, type AdminOrderDto } from "@/app/services/adminApi";
import { useAuth } from "@/app/guards/AuthContext";
import { cn, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { OrderMedicalReferenceCard } from "@/app/components/shared/OrderMedicalReferenceCard";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import type { OrderContinuationsDto } from "@/app/services/vendorOnboardingApi";

const statusOptions = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_transit", label: "In Transit" },
  { id: "active", label: "Active" },
  { id: "returned", label: "Returned" },
  { id: "bought_out", label: "Bought Out" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dispatch_failed", label: "Dispatch Failed" },
] as const;

function getBaseOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").slice(0, 3).join("-");
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending" || s.includes("awaiting")) {
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
    return "bg-destructive/10 text-destructive border-destructive/20";
  }
  if (s === "bought out") {
    return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300";
  }
  return "bg-muted text-foreground border-border";
}

function getTimelineSteps(orderType?: string) {
  const isBuy = orderType?.toLowerCase() === "buy";
  if (isBuy) {
    return [
      { key: "placed", label: "Order Placed" },
      { key: "confirmed", label: "Vendor Confirmed" },
      { key: "out", label: "Out for Delivery" },
      { key: "active", label: "Delivered & Purchased" },
    ];
  }
  return [
    { key: "placed", label: "Order Placed" },
    { key: "confirmed", label: "Vendor Confirmed" },
    { key: "out", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
    { key: "active", label: "Rental Active" },
    { key: "returned", label: "Returned" },
    { key: "bought_out", label: "Bought Out" },
  ];
}

function getTimelineProgress(status: string, orderType?: string) {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

  if (compact === "cancelled" || compact === "canceled") {
    return { cancelled: true, completedThrough: -1, currentIndex: null as number | null };
  }
  if (compact === "dispatch_failed" || raw.includes("dispatch failed")) {
    return { cancelled: false, completedThrough: 0, currentIndex: null as number | null };
  }
  if (compact === "pending" || compact.includes("awaiting")) {
    return { cancelled: false, completedThrough: 0, currentIndex: 1 };
  }
  if (compact === "confirmed") {
    return { cancelled: false, completedThrough: 1, currentIndex: 2 };
  }
  if (compact === "in_transit" || raw.includes("transit")) {
    return { cancelled: false, completedThrough: 2, currentIndex: 3 };
  }
  if (compact === "active") {
    return isBuy
      ? { cancelled: false, completedThrough: 3, currentIndex: null as number | null }
      : { cancelled: false, completedThrough: 4, currentIndex: null as number | null };
  }
  if (compact === "bought_out") {
    return { cancelled: false, completedThrough: 6, currentIndex: null as number | null };
  }
  if (compact === "returned") {
    return { cancelled: false, completedThrough: 5, currentIndex: null as number | null };
  }
  return { cancelled: false, completedThrough: 0, currentIndex: 1 };
}

function getAvailableStatuses(currentStatus: string, orderType?: string): string[] {
  const s = currentStatus.toLowerCase().trim().replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

  if (s === "pending" || s.includes("awaiting")) return ["pending", "confirmed", "cancelled"];
  if (s === "confirmed") return ["confirmed", "in_transit", "cancelled", "dispatch_failed"];
  if (s === "in_transit" || s.includes("transit")) return ["in_transit", "active", "dispatch_failed", "returned"];
  if (s === "active") return isBuy ? ["active"] : ["active", "returned", "bought_out"];
  if (s === "bought_out") return ["bought_out"];
  if (s === "returned") return ["returned"];
  if (s === "cancelled" || s === "canceled") return ["cancelled"];
  if (s === "dispatch_failed" || s.includes("dispatch failed")) return ["dispatch_failed", "cancelled"];
  return ["pending", "confirmed", "in_transit", "active", "returned", "cancelled", "dispatch_failed"];
}

function formatDetailDate(value?: string | null): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function OrderTimeline({ status, orderType }: { status: string; orderType?: string }) {
  const { cancelled, completedThrough, currentIndex } = getTimelineProgress(status, orderType);
  if (cancelled) {
    return <p className="text-sm text-destructive font-medium">This order item was cancelled.</p>;
  }
  const steps = getTimelineSteps(orderType);
  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const isDone = i <= completedThrough;
        const isCurrent = currentIndex === i;
        const isUpcoming = !isDone && !isCurrent;
        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 ? (
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
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const AdminOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [statusUpdateLocal, setStatusUpdateLocal] = useState("");
  const [continuations, setContinuations] = useState<OrderContinuationsDto | null>(null);
  const [continuationsUpdating, setContinuationsUpdating] = useState(false);

  const currentItemId = selectedItemId || orderId;

  useEffect(() => {
    setSelectedItemId(null);
  }, [orderId]);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders({ quiet: true }),
  });

  const selectedOrder = useMemo(() => {
    if (!currentItemId) return null;
    return orders.find((o) => o.orderId === currentItemId) ?? null;
  }, [orders, currentItemId]);

  const orderGroupItems = useMemo(() => {
    if (!selectedOrder) return [] as AdminOrderDto[];
    const base = getBaseOrderNumber(selectedOrder.orderNumber);
    const matches = orders
      .filter((o) => getBaseOrderNumber(o.orderNumber) === base)
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
    return matches.length > 0 ? matches : [selectedOrder];
  }, [selectedOrder, orders]);

  const groupTotalAmount = useMemo(
    () => orderGroupItems.reduce((sum, item) => sum + (item.totalAmount ?? 0), 0),
    [orderGroupItems],
  );

  const groupDepositAmount = useMemo(
    () => orderGroupItems.reduce((sum, item) => sum + (item.depositAmount ?? 0), 0),
    [orderGroupItems],
  );

  const baseOrderNumber = selectedOrder ? getBaseOrderNumber(selectedOrder.orderNumber) : "";

  useEffect(() => {
    if (!selectedOrder) {
      setContinuations(null);
      return;
    }
    setStatusUpdateLocal(selectedOrder.status);
    adminApi
      .getAdminOrderContinuations(selectedOrder.orderId)
      .then(setContinuations)
      .catch((err) => {
        console.error("Failed to load continuations", err);
        setContinuations(null);
      });
  }, [selectedOrder?.orderId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      adminApi.updateAdminOrderStatus({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
        status: newStatus,
      }),
    onSuccess: () => {
      toast.success("Status updated.");
      invalidate();
    },
    onError: (error) => toast.error(getUserFriendlyMessage(error) || "Failed to update status"),
  });

  const cancelRefundMutation = useMutation({
    mutationFn: () =>
      adminApi.forceCancelRefundOrder({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
      }),
    onSuccess: () => {
      toast.success("Order cancelled and refunded.");
      invalidate();
    },
    onError: (error) => toast.error(getUserFriendlyMessage(error) || "Failed to force cancel"),
  });

  const restartDispatchMutation = useMutation({
    mutationFn: () =>
      adminApi.restartOrderDispatch({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
      }),
    onSuccess: () => {
      toast.success("Dispatch restarted.");
      invalidate();
    },
    onError: (error) => toast.error(getUserFriendlyMessage(error) || "Failed to restart dispatch"),
  });

  const loadContinuations = async () => {
    if (!selectedOrder) return;
    try {
      setContinuations(await adminApi.getAdminOrderContinuations(selectedOrder.orderId));
    } catch (err) {
      console.error(err);
    }
  };

  const runContinuation = async (fn: () => Promise<unknown>, successMsg: string) => {
    if (!selectedOrder) return;
    try {
      setContinuationsUpdating(true);
      await fn();
      toast.success(successMsg);
      await Promise.all([loadContinuations(), invalidate()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setContinuationsUpdating(false);
    }
  };

  if (!orderId) {
    return <p className="text-sm text-muted-foreground">Missing order.</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load orders."}
        </p>
        <Button variant="outline" asChild>
          <Link to="/admin/orders">Back to orders</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <PageLoaderSlot />;
  }

  if (!selectedOrder) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Button variant="ghost" className="-ml-2 h-auto px-2 text-sm text-muted-foreground" asChild>
          <Link to="/admin/orders">← Back to orders</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const hasPendingContinuations = Boolean(
    continuations &&
      (continuations.pendingExtensions.length > 0 || continuations.pendingBuyouts.length > 0),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 h-auto px-2 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/admin/orders")}
      >
        ← Back to orders
      </Button>

      {/* Group header */}
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2 lg:pr-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Group</p>
              <h1 className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{baseOrderNumber}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedOrder.customerName}
                <span className="text-muted-foreground/70"> · {selectedOrder.customerEmail}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="text-3xl font-bold tabular-nums tracking-tight">₹{groupTotalAmount.toFixed(0)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Combined total{orderGroupItems.length > 1 ? ` · ${orderGroupItems.length} items` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                + ₹{groupDepositAmount.toFixed(0)} deposit
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items picker */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4">
          <p className="text-lg font-semibold">Items in this Order</p>
          <p className="text-xs text-muted-foreground">
            Select an item to view its timeline, vendor assignment, and admin actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderGroupItems.map((item) => {
            const isSelected = item.orderId === selectedOrder.orderId;
            const imageUrl = resolveItemImageUrl(item);
            return (
              <button
                key={item.orderId}
                type="button"
                onClick={() => setSelectedItemId(item.orderId)}
                className={cn(
                  "w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border transition-all",
                  isSelected
                    ? "bg-accent/40 border-foreground/60 shadow-sm"
                    : "bg-transparent border-border/60 hover:bg-accent/20",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.listingTitle}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover border border-border bg-muted"
                      onError={retryOriginalOnImageError}
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                      <Package className="h-5 w-5 opacity-60" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.listingTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Qty: {item.quantity}
                      <span className="ml-2 tabular-nums">· {item.orderNumber}</span>
                      <span className="ml-2">· {item.vendorName}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 mt-3 sm:mt-0 pl-[3.75rem] sm:pl-0">
                  <Badge
                    className={cn("text-[10px] font-medium capitalize", orderStatusBadgeClass(item.status))}
                    variant="outline"
                  >
                    {item.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-semibold tabular-nums text-xs sm:w-16 sm:text-right">
                    ₹{item.totalAmount.toFixed(0)}
                  </span>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {hasPendingContinuations && continuations && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <p className="text-lg font-semibold text-amber-900 dark:text-amber-400">Pending Customer Requests</p>
            <p className="text-xs text-muted-foreground">For: {selectedOrder.listingTitle}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {continuations.pendingExtensions.map((ext) => (
              <div
                key={ext.extensionId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-100 bg-white p-3 dark:border-amber-900/30 dark:bg-black/20"
              >
                <div>
                  <p className="text-sm font-semibold">Rent Extension</p>
                  <p className="text-sm text-muted-foreground">+{ext.additionalDays} days · ₹{ext.totalAmount.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={continuationsUpdating}
                    onClick={() =>
                      void runContinuation(
                        () => adminApi.cancelAdminExtension(selectedOrder.orderId, ext.extensionId, user?.id || ""),
                        "Extension rejected.",
                      )
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={continuationsUpdating}
                    onClick={() =>
                      void runContinuation(
                        () => adminApi.approveAdminExtension(selectedOrder.orderId, ext.extensionId, user?.id || ""),
                        "Extension approved.",
                      )
                    }
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
            {continuations.pendingBuyouts.map((buy) => (
              <div
                key={buy.buyoutId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-100 bg-white p-3 dark:border-amber-900/30 dark:bg-black/20"
              >
                <div>
                  <p className="text-sm font-semibold">Product Buyout</p>
                  <p className="text-sm text-muted-foreground">₹{buy.totalAmount.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={continuationsUpdating}
                    onClick={() =>
                      void runContinuation(
                        () => adminApi.cancelAdminBuyout(selectedOrder.orderId, buy.buyoutId, user?.id || ""),
                        "Buyout rejected.",
                      )
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={continuationsUpdating}
                    onClick={() =>
                      void runContinuation(
                        () => adminApi.approveAdminBuyout(selectedOrder.orderId, buy.buyoutId, user?.id || ""),
                        "Buyout approved.",
                      )
                    }
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <p className="text-lg font-semibold">Order timeline</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tracking: <span className="font-semibold text-foreground">{selectedOrder.listingTitle}</span>
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <OrderTimeline status={selectedOrder.status} orderType={selectedOrder.orderType} />
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Admin actions</p>
              <p className="text-xs text-muted-foreground">Applies to the selected item only.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedOrder.status === "dispatch_failed" && (
                <TooltipProvider>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button className="w-full" disabled={restartDispatchMutation.isPending}>
                              {restartDispatchMutation.isPending ? "Reassigning..." : "Reassign Order"}
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center" side="top">
                          Broadcasts a new dispatch offer to eligible nearby vendors.
                        </TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reassign Order?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The system will broadcast a new offer to eligible vendors in the area.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => restartDispatchMutation.mutate()}>Reassign</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full" disabled={cancelRefundMutation.isPending}>
                              {cancelRefundMutation.isPending ? "Cancelling..." : "Force Cancel"}
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center" side="top">
                          Cancels the order and issues a full refund to the customer.
                        </TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Force Cancel & Refund?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently cancels the order and refunds the customer. It cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Order</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            onClick={() => cancelRefundMutation.mutate()}
                          >
                            Force Cancel
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TooltipProvider>
              )}

              <div
                className={cn(
                  "flex flex-col sm:flex-row sm:items-end gap-4 p-4 rounded-lg border",
                  hasPendingContinuations ? "bg-muted/50 opacity-60" : "bg-accent/20 border-border/40",
                )}
              >
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Force status update</p>
                  <Select
                    value={statusUpdateLocal}
                    onValueChange={setStatusUpdateLocal}
                    disabled={hasPendingContinuations}
                  >
                    <SelectTrigger className="w-full sm:w-[200px] bg-background">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions
                        .filter((t) => getAvailableStatuses(selectedOrder.status, selectedOrder.orderType).includes(t.id))
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => updateStatusMutation.mutate(statusUpdateLocal)}
                  disabled={
                    hasPendingContinuations ||
                    !statusUpdateLocal ||
                    statusUpdateLocal === selectedOrder.status ||
                    updateStatusMutation.isPending
                  }
                >
                  {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Customer</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Name
                </p>
                <p className="font-medium">{selectedOrder.customerName}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.customerEmail}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" /> Assigned vendor
                </p>
                <p className="font-medium">{selectedOrder.vendorName || "Unassigned"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">
                {selectedOrder.orderType?.toLowerCase() === "buy" ? "Purchase details" : "Rental details"}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {selectedOrder.orderType === "rent" ? "Period" : "Purchase date"}
                </p>
                <p className="font-medium">
                  {selectedOrder.orderType === "rent"
                    ? `${formatDetailDate(selectedOrder.startDate)} → ${formatDetailDate(selectedOrder.endDate)}`
                    : formatDetailDate(selectedOrder.startDate)}
                </p>
                {selectedOrder.orderType === "rent" ? (
                  <p className="text-xs text-muted-foreground">{selectedOrder.rentalDays} days</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Quantity
                </p>
                <p className="font-medium">{selectedOrder.quantity}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Amount
                </p>
                <p className="font-bold tabular-nums">₹{selectedOrder.totalAmount.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  + ₹{selectedOrder.depositAmount.toFixed(0)} deposit
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                <Badge className={cn("capitalize text-[10px]", orderStatusBadgeClass(selectedOrder.status))} variant="outline">
                  {selectedOrder.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {(selectedOrder.doctorId ||
            selectedOrder.hospitalId ||
            selectedOrder.doctorName ||
            selectedOrder.doctorUniqueCode) && (
            <OrderMedicalReferenceCard
              doctorName={selectedOrder.doctorName}
              doctorSpecialization={selectedOrder.doctorSpecialization}
              doctorUniqueCode={selectedOrder.doctorUniqueCode}
              doctorContactNumber={selectedOrder.doctorContactNumber}
              hospitalName={selectedOrder.hospitalName}
              hospitalCity={selectedOrder.hospitalCity}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
