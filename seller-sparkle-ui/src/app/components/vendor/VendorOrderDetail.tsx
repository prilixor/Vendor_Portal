import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorOrderApiDto, type VendorProductAssetApiDto, type OrderContinuationsDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";

const getTimelineSteps = (orderType?: string) => {
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
};

function formatDetailDate(value?: string): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function timelineProgress(status: string, orderType?: string): { completedThrough: number; currentIndex: number | null } {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

  if (compact === "pending") return { completedThrough: 0, currentIndex: 1 };
  if (compact === "confirmed") return { completedThrough: 1, currentIndex: 2 };
  if (compact === "in_transit" || raw.includes("transit")) return { completedThrough: 2, currentIndex: 3 };
  if (compact === "active") {
    return isBuy
      ? { completedThrough: 3, currentIndex: null }
      : { completedThrough: 4, currentIndex: null };
  }
  if (compact === "returned") return { completedThrough: 5, currentIndex: null };
  if (compact === "bought_out") return { completedThrough: 6, currentIndex: null };
  return { completedThrough: 0, currentIndex: 1 };
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
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
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
  if (s === "bought out") {
    return "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-medium shadow-sm border-0 dark:from-fuchsia-600 dark:to-purple-700";
  }
  return "bg-muted text-foreground";
}

function OrderTimeline({ status, orderType }: { status: string; orderType?: string }) {
  const { completedThrough, currentIndex } = timelineProgress(status, orderType);
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
              {!isCurrent && step.key === "active" && status.trim().toLowerCase() === "active" && orderType?.toLowerCase() !== "buy" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Current status</p>
              ) : null}
              {!isCurrent && step.key === "bought_out" && status.trim().toLowerCase() === "bought_out" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Purchased by customer</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const VendorOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [order, setOrder] = useState<VendorOrderApiDto | null>(null);
  const [continuations, setContinuations] = useState<OrderContinuationsDto | null>(null);

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchAssetTags, setDispatchAssetTags] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<VendorProductAssetApiDto[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});

  const loadOrder = async () => {
    if (!user || !orderId) return;
    try {
      setLoading(true);
      const row = await vendorOnboardingApi.getVendorOrder(user.id, orderId);
      setOrder(row);
      try {
        const conts = await vendorOnboardingApi.getVendorOrderContinuations(orderId);
        setContinuations(conts);
      } catch (err) {
        console.error("Failed to load continuations", err);
      }
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
    if (status === "in_transit" && !dispatchDialogOpen) {
      setDispatchDialogOpen(true);
      setDispatchAssetTags(new Array(order!.quantity).fill(""));
      
      try {
        setLoadingAssets(true);
        const data = await vendorOnboardingApi.getVendorProductAssets(user!.id, order!.listingId);
        setAvailableAssets(data.filter(a => a.status.toLowerCase() === 'available'));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingAssets(false);
      }
      return;
    }

    if (!user || !orderId) return;
    try {
      setUpdating(true);
      const assetTagsToSubmit = (status === "in_transit" || status === "active") ? dispatchAssetTags.filter(t => t.trim() !== "") : undefined;
      await vendorOnboardingApi.updateVendorOrderStatus(user.id, orderId, status, assetTagsToSubmit);
      toast.success("Order status updated.");
      setDispatchDialogOpen(false);
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

  const hasPendingRequests = Boolean(continuations && (continuations.pendingExtensions.length > 0 || continuations.pendingBuyouts.length > 0));

  const normalizedStatus = order?.status.trim().toLowerCase() ?? "";
  const canMarkTransit = normalizedStatus === "confirmed" && !hasPendingRequests;
  const canMarkActive = (normalizedStatus === "in transit" || normalizedStatus === "in_transit") && !hasPendingRequests;
  const canMarkReturned = normalizedStatus === "active" && order?.orderType.toLowerCase() !== "buy" && !hasPendingRequests;
  const canCancel = normalizedStatus === "confirmed" && !hasPendingRequests;

  const handleCancelBuyout = async (buyoutId: string) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelVendorBuyout(orderId, buyoutId);
      toast.success("Buyout request cancelled.");
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApproveBuyout = async (buyoutId: string) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.approveVendorBuyout(orderId, buyoutId);
      toast.success("Buyout request approved.");
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelExtension = async (extensionId: string) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelVendorExtension(orderId, extensionId);
      toast.success("Extension request cancelled.");
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApproveExtension = async (extensionId: string) => {
    if (!orderId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.approveVendorExtension(orderId, extensionId);
      toast.success("Extension request approved.");
      await loadOrder();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setUpdating(false);
    }
  };

  const nextAction = useMemo(() => {
    if (hasPendingRequests) return { label: "Review customer request", disabled: true };
    if (canMarkReturned) return { label: "Mark returned", action: () => handleStatusChange("returned") };
    if (canMarkActive) return { label: "Mark delivered", action: () => handleStatusChange("active") };
    if (canMarkTransit) return { label: "Mark out for delivery", action: () => handleStatusChange("in_transit") };
    return null;
  }, [canMarkActive, canMarkReturned, canMarkTransit, hasPendingRequests]);

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
                  <span className={cn("inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm capitalize", orderStatusBadgeClass(order.status))}>
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  ₹{((order.vendorSubtotalAmount && order.vendorSubtotalAmount > 0) ? order.vendorSubtotalAmount : order.totalAmount).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground uppercase font-semibold tracking-wider">Estimated Vendor Payout</p>
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
              <Button onClick={() => nextAction.action && void nextAction.action()} disabled={updating || nextAction.disabled}>
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
          {continuations && (continuations.pendingExtensions.length > 0 || continuations.pendingBuyouts.length > 0) && (
            <Card className="border-amber-200 bg-amber-50 shadow-sm dark:bg-amber-950/20 dark:border-amber-900/50">
              <CardHeader className="pb-2">
                <p className="text-lg font-semibold text-amber-900 dark:text-amber-400">Pending Customer Requests</p>
              </CardHeader>
              <CardContent className="pt-2 space-y-4">
                {continuations.pendingExtensions.map((ext) => (
                  <div key={ext.extensionId} className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-white dark:bg-black/20 rounded-md border border-amber-100 dark:border-amber-900/30">
                    <div>
                      <p className="font-semibold text-sm">Rent Extension Request</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Customer wants to extend by <span className="font-medium">{ext.additionalDays} days</span>.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-white/50 dark:bg-black/40 p-2 rounded border border-amber-200/50">
                        <p className="text-muted-foreground">Original End Date:</p>
                        <p className="font-medium text-right">{formatDetailDate(ext.originalEndDate)}</p>
                        <p className="text-muted-foreground">New End Date:</p>
                        <p className="font-medium text-right">{formatDetailDate(ext.newEndDate)}</p>
                        <p className="col-span-2 my-0.5 border-t border-amber-200/50"></p>
                        <p className="text-muted-foreground">Base Extension Rent:</p>
                        <p className="text-right">₹{ext.extensionAmount.toFixed(2)}</p>
                        <p className="text-muted-foreground">Service Fee:</p>
                        <p className="text-right">₹{ext.serviceFeeAmount.toFixed(2)}</p>
                        <p className="text-muted-foreground">GST:</p>
                        <p className="text-right">₹{ext.gstAmount.toFixed(2)}</p>
                        <p className="font-semibold text-amber-900 dark:text-amber-400">Total to Collect:</p>
                        <p className="font-bold text-right text-amber-900 dark:text-amber-400">₹{ext.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 sm:mt-0 items-start">
                      <Button variant="outline" size="sm" onClick={() => handleCancelExtension(ext.extensionId)} disabled={updating}>Reject</Button>
                      <Button size="sm" onClick={() => handleApproveExtension(ext.extensionId)} disabled={updating}>Approve</Button>
                    </div>
                  </div>
                ))}
                {continuations.pendingBuyouts.map((buy) => (
                  <div key={buy.buyoutId} className="flex flex-col sm:flex-row justify-between p-4 bg-white dark:bg-black/20 rounded-md border border-amber-100 dark:border-amber-900/30">
                    <div className="flex-1 max-w-sm">
                      <p className="font-semibold text-sm">Product Buyout Request</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Customer wants to buy this rented product permanently.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-white/50 dark:bg-black/40 p-2 rounded border border-amber-200/50">
                        <p className="text-muted-foreground">Base Buyout Value:</p>
                        <p className="text-right">₹{buy.baseBuyoutAmount.toFixed(2)}</p>
                        <p className="text-muted-foreground">Rent Deduction:</p>
                        <p className="text-right text-emerald-600">-₹{buy.rentDeductionAmount.toFixed(2)}</p>
                        <p className="text-muted-foreground">Service Fee:</p>
                        <p className="text-right">₹{buy.serviceFeeAmount.toFixed(2)}</p>
                        <p className="text-muted-foreground">GST:</p>
                        <p className="text-right">₹{buy.gstAmount.toFixed(2)}</p>
                        <p className="col-span-2 my-0.5 border-t border-amber-200/50"></p>
                        <p className="font-semibold text-amber-900 dark:text-amber-400">Total to Collect:</p>
                        <p className="font-bold text-right text-amber-900 dark:text-amber-400">₹{buy.totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 sm:mt-0 items-start">
                      <Button variant="outline" size="sm" onClick={() => handleCancelBuyout(buy.buyoutId)} disabled={updating}>Reject</Button>
                      <Button size="sm" onClick={() => handleApproveBuyout(buy.buyoutId)} disabled={updating}>Approve</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <p className="text-lg font-semibold">Order timeline</p>
            </CardHeader>
            <CardContent className="pt-2">
              <OrderTimeline status={order.status} orderType={order.orderType} />
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
              <p className="text-lg font-semibold">{order.orderType?.toLowerCase() === "buy" ? "Purchase details" : "Rental details"}</p>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              {order.orderType?.toLowerCase() === "buy" ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchase date</p>
                    <p className="text-sm font-medium tabular-nums">{formatDetailDate(order.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order type</p>
                      {order.status === "bought_out" && (
                        <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">
                          BOUGHT OUT
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium uppercase">{order.orderType}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start date</p>
                    <p className="text-sm font-medium tabular-nums">{formatDetailDate(order.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End date</p>
                      {order.isExtended && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          EXTENDED
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium tabular-nums">{formatDetailDate(order.endDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental days</p>
                    <p className="text-sm font-medium">{order.rentalDays}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order type</p>
                      {order.status === "bought_out" && (
                        <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300">
                          BOUGHT OUT
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium uppercase">{order.orderType}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Medical Reference */}
          {(order.doctorId || order.hospitalId) && (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-4">
                <p className="text-lg font-semibold">Medical reference</p>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                {order.doctorName && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doctor</p>
                    <p className="text-sm font-medium">
                      {order.doctorName}
                      {order.doctorSpecialization && (
                        <span className="text-muted-foreground font-normal ml-1">
                          - {order.doctorSpecialization}
                        </span>
                      )}
                    </p>
                    {order.doctorContactNumber && (
                      <p className="text-xs text-muted-foreground">{order.doctorContactNumber}</p>
                    )}
                  </div>
                )}
                {order.hospitalName && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hospital</p>
                    <p className="text-sm font-medium">
                      {order.hospitalName}
                      {order.hospitalCity && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({order.hospitalCity})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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

      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please enter the serial numbers or asset tags for the {order?.quantity} items being dispatched. 
              You can select from pre-registered available stock or type new ones.
            </p>
            {loadingAssets ? (
                <p className="text-sm">Loading available stock...</p>
            ) : (
                <div className="space-y-3">
                  {dispatchAssetTags.map((tag, idx) => {
                    const matchingAssets = availableAssets.filter((a) =>
                      a.assetTag.toLowerCase().includes(tag.toLowerCase())
                    );
                    const isOpen = openDropdowns[idx] && matchingAssets.length > 0;

                    return (
                      <div key={idx} className="space-y-1.5 relative">
                        <Label>Item {idx + 1} Serial Number (Optional)</Label>
                        <Input
                          placeholder="Enter or select serial number..."
                          value={tag}
                          onChange={(e) => {
                            const newTags = [...dispatchAssetTags];
                            newTags[idx] = e.target.value;
                            setDispatchAssetTags(newTags);
                            setOpenDropdowns({ ...openDropdowns, [idx]: true });
                          }}
                          onFocus={() => setOpenDropdowns({ ...openDropdowns, [idx]: true })}
                          onBlur={() => setTimeout(() => setOpenDropdowns({ ...openDropdowns, [idx]: false }), 150)}
                        />
                        {isOpen && (
                          <div className="absolute top-full left-0 z-[100] mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                            {matchingAssets.map((a) => (
                              <div
                                key={a.id}
                                className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                  const newTags = [...dispatchAssetTags];
                                  newTags[idx] = a.assetTag;
                                  setDispatchAssetTags(newTags);
                                  setOpenDropdowns({ ...openDropdowns, [idx]: false });
                                }}
                              >
                                {a.assetTag}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleStatusChange("in_transit")} disabled={updating}>
                Confirm Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorOrderDetail;
