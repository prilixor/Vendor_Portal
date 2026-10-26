import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Building, Package, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { ZoomableImageStage } from "@/app/components/shared/ZoomableImageStage";
import { adminApi, type AdminOrderDto } from "@/app/services/adminApi";
import { useAuth } from "@/app/guards/AuthContext";
import { formatGstRateLabel } from "@/app/helpers/gstLabel";
import { formatOrderStatusLabel, formatOrderStatusTitle, orderShowsVendorPayout, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import { adminRefundChip, formatInr } from "@/app/helpers/orderReturn";
import { mediaObjectKey, useStableMediaUrls } from "@/app/helpers/stableMediaUrl";
import { adminCancellationChip, type OrderCancellationApi } from "@/app/helpers/orderCancellation";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { toast } from "sonner";
import { BackLink } from "@/app/components/shared/BackLink";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { OrderPrescriptionFilesCard } from "@/app/components/shared/OrderPrescriptionFilesCard";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
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
import { extensionVendorPayout, type OrderContinuationsDto } from "@/app/services/vendorOnboardingApi";

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

function getTimelineSteps(orderType?: string, status?: string) {
  const isBuy = orderType?.toLowerCase() === "buy";
  if (isBuy) {
    return [
      { key: "placed", label: "Order Placed" },
      { key: "confirmed", label: "Vendor Confirmed" },
      { key: "out", label: "Out for Delivery" },
      { key: "active", label: "Delivered & Purchased" },
    ];
  }
  const steps = [
    { key: "placed", label: "Order Placed" },
    { key: "confirmed", label: "Vendor Confirmed" },
    { key: "out", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
    { key: "active", label: "Rental Active" },
    { key: "returned", label: "Returned" },
  ];
  // Customers can no longer request a buyout. Keep the stage only for an order that was already bought out.
  if (status?.trim().toLowerCase().replace(/\s+/g, "_") === "bought_out") {
    steps.push({ key: "bought_out", label: "Bought Out" });
  }
  return steps;
}

function getTimelineProgress(status: string, orderType?: string) {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";
  const open = { cancelled: false, dispatchFailed: false };

  if (compact === "cancelled" || compact === "canceled") {
    return { cancelled: true, dispatchFailed: false, completedThrough: -1, currentIndex: null as number | null };
  }
  if (compact === "dispatch_failed" || raw.includes("dispatch failed")) {
    return { cancelled: false, dispatchFailed: true, completedThrough: -1, currentIndex: null as number | null };
  }
  if (compact === "pending" || compact.includes("awaiting")) {
    return { ...open, completedThrough: 0, currentIndex: 1 };
  }
  if (compact === "confirmed") {
    return { ...open, completedThrough: 1, currentIndex: 2 };
  }
  if (compact === "in_transit" || raw.includes("transit")) {
    return { ...open, completedThrough: 2, currentIndex: 3 };
  }
  if (compact === "active") {
    return isBuy
      ? { ...open, completedThrough: 3, currentIndex: null as number | null }
      : { ...open, completedThrough: 4, currentIndex: null as number | null };
  }
  if (compact === "bought_out") {
    return { ...open, completedThrough: 6, currentIndex: null as number | null };
  }
  if (compact === "returned") {
    return { ...open, completedThrough: 5, currentIndex: null as number | null };
  }
  return { ...open, completedThrough: 0, currentIndex: 1 };
}

function getAvailableStatuses(currentStatus: string, orderType?: string): string[] {
  const s = currentStatus.toLowerCase().trim().replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

  if (s === "pending" || s.includes("awaiting")) return ["pending", "confirmed", "cancelled"];
  if (s === "confirmed") return ["confirmed", "in_transit", "cancelled", "dispatch_failed"];
  if (s === "in_transit" || s.includes("transit")) return ["in_transit", "active", "dispatch_failed", "returned"];
  if (s === "active") return isBuy ? ["active"] : ["active", "returned"];
  if (s === "bought_out") return ["bought_out"];
  if (s === "returned") return ["returned"];
  if (s === "cancelled" || s === "canceled") return ["cancelled"];
  if (s === "dispatch_failed" || s.includes("dispatch failed")) return ["dispatch_failed"];
  return ["pending", "confirmed", "in_transit", "active", "returned", "cancelled", "dispatch_failed"];
}

function formatDetailDate(value?: string | null): string {
  if (!value?.trim()) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function OrderTimeline({ status, orderType }: { status: string; orderType?: string }) {
  const { cancelled, dispatchFailed, completedThrough, currentIndex } = getTimelineProgress(status, orderType);
  if (dispatchFailed) {
    return <p className="text-sm font-medium text-destructive">No vendor accepted this product.</p>;
  }
  if (cancelled) {
    return <p className="text-sm text-destructive font-medium">This order item was cancelled.</p>;
  }
  const steps = getTimelineSteps(orderType, status);
  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const isDone = i <= completedThrough;
        const isCurrent = currentIndex === i;
        const isUpcoming = !isDone && !isCurrent;
        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4 sm:pb-8">
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

function CancellationRefundBody({
  row,
  chargeText,
  reason,
  manual,
  pending,
  onCharge,
  onReason,
  onManual,
  onSubmit,
}: {
  row: OrderCancellationApi;
  chargeText: string;
  reason: string;
  manual: string;
  pending: boolean;
  onCharge: (value: string) => void;
  onReason: (value: string) => void;
  onManual: (value: string) => void;
  onSubmit: (reference?: string) => void;
}) {
  const charge = Number(chargeText || 0);
  const chargeInvalid = !Number.isFinite(charge) || charge < 0 || charge - row.paidAmount > 0.009;
  const preview = Math.max(0, Math.round((row.paidAmount - (chargeInvalid ? 0 : charge)) * 100) / 100);
  const reasonMissing = charge > 0 && !reason.trim();
  const locked = row.status === "refunded" || row.status === "settled";
  const shownCharge = locked || row.status === "refunding" ? row.chargeAmount : chargeInvalid ? 0 : charge;
  const shownRefund = locked || row.status === "refunding" ? row.refundAmount : preview;
  const canSendOnline = row.hasOnlinePayment && preview > 0 && !chargeInvalid && !reasonMissing;
  const manualBlocked = pending || !manual.trim() || (row.status === "pending_review" && (chargeInvalid || reasonMissing));

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer paid</p>
          <p className="font-medium tabular-nums">₹{formatInr(row.paidAmount)}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Charge</p>
          <p className="font-medium tabular-nums">₹{formatInr(shownCharge)}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/80 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refund to customer</p>
          <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">₹{formatInr(shownRefund)}</p>
        </div>
      </div>
      <div className="space-y-3">
      {row.status === "refunded" ? (
        <p>
          Refunded
          {row.refundedAt ? ` on ${new Date(row.refundedAt).toLocaleString()}` : ""}
          {row.refundReference ? ` · ${row.refundReference}` : ""}
        </p>
      ) : row.status === "settled" ? (
        <p className="text-muted-foreground">
          {row.chargeAmount > 0
            ? "No refund. The charge uses the full payment for this product."
            : "No refund is due on this product."}
        </p>
      ) : pending ? (
        <p className="text-muted-foreground">Sending this refund…</p>
      ) : (
        <div className="space-y-4">
          {row.status === "pending_review" ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Charge to deduct</p>
                <p className="text-xs text-muted-foreground">Optional. Leave 0 to refund the full amount paid for this product.</p>
                <Input
                  inputMode="decimal"
                  value={chargeText}
                  placeholder="0"
                  onChange={(event) => onCharge(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Reason {charge > 0 ? "" : "(only if you deduct a charge)"}</p>
                <Textarea
                  value={reason}
                  maxLength={500}
                  rows={2}
                  placeholder="Why this charge is deducted"
                  onChange={(event) => onReason(event.target.value)}
                />
              </div>
              {chargeInvalid ? <p className="text-destructive">Enter a charge from ₹0 up to the amount paid.</p> : null}
              {reasonMissing ? <p className="text-destructive">Add a reason before deducting this charge.</p> : null}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Part of this refund may already have been sent. Send the rest, or record a reference if you paid the customer yourself.
              {row.chargeReason ? ` Charge: ${row.chargeReason}` : ""}
            </p>
          )}

          {row.status === "pending_review" && preview <= 0 && !chargeInvalid ? (
            <Button type="button" className="w-full" disabled={pending || reasonMissing} onClick={() => onSubmit(undefined)}>
              Apply charge and close
            </Button>
          ) : null}

          {preview > 0 && row.hasOnlinePayment ? (
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full"
                disabled={pending || !canSendOnline}
                onClick={() => onSubmit(undefined)}
              >
                {row.status === "refunding" ? "Send the rest through Razorpay" : `Refund ₹${formatInr(preview)} through Razorpay`}
              </Button>
              <p className="text-xs text-muted-foreground">
                Sends only this product back to the original payment. Other products in the checkout stay as they are.
              </p>
            </div>
          ) : null}

          {preview > 0 ? (
            <div className="space-y-2 rounded-lg border border-dashed border-border px-3 py-3">
              <p className="text-sm font-medium">Already paid the customer another way?</p>
              <p className="text-xs text-muted-foreground">
                {row.hasOnlinePayment
                  ? "Use this after a UPI, bank, or Razorpay dashboard refund. This does not send money."
                  : "Razorpay cannot send this refund from here. Pay the customer, then save the reference."}
              </p>
              <Input
                value={manual}
                maxLength={120}
                onChange={(event) => onManual(event.target.value)}
                placeholder="UPI, bank, or Razorpay reference"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={manualBlocked}
                onClick={() => onSubmit(manual.trim())}
              >
                Save manual refund
              </Button>
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}

const AdminOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [statusUpdateLocal, setStatusUpdateLocal] = useState("");
  const [manualReference, setManualReference] = useState("");
  const [showManualRefund, setShowManualRefund] = useState(false);
  const [cancelCharge, setCancelCharge] = useState("");
  const [cancelChargeReason, setCancelChargeReason] = useState("");
  const [cancelManual, setCancelManual] = useState("");
  const [damagePreviewUrl, setDamagePreviewUrl] = useState<string | null>(null);
  const [continuations, setContinuations] = useState<OrderContinuationsDto | null>(null);
  const [continuationsUpdating, setContinuationsUpdating] = useState(false);

  const currentItemId = selectedItemId || orderId;

  useEffect(() => {
    setSelectedItemId(null);
  }, [orderId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-order-detail", orderId],
    queryFn: () => adminApi.getAdminOrderDetail(orderId!, { quiet: true }),
    enabled: !!orderId,
    refetchInterval: 5_000,
  });
  const orders = data?.items ?? [];

  const { data: prescriptionFiles = [] } = useQuery({
    queryKey: ["admin-order-prescriptions", currentItemId],
    queryFn: () => adminApi.getAdminOrderPrescriptions(currentItemId!),
    enabled: !!currentItemId,
  });

  const selectedOrder = useMemo(() => {
    if (!currentItemId) return null;
    return orders.find((o) => o.orderId === currentItemId) ?? null;
  }, [orders, currentItemId]);
  const damagePhotoUrls = useStableMediaUrls(selectedOrder?.returnSettlement?.damageImageUrls ?? []);

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

  const payableGroupItems = useMemo(
    () => orderGroupItems.filter((item) => orderShowsVendorPayout(item.status)),
    [orderGroupItems],
  );

  const groupVendorPayout = useMemo(
    () => payableGroupItems.reduce((sum, item) => sum + (item.vendorSubtotalAmount ?? 0), 0),
    [payableGroupItems],
  );

  const baseOrderNumber = selectedOrder ? getBaseOrderNumber(selectedOrder.orderNumber) : "";

  useEffect(() => {
    if (!selectedOrder) return;
    setStatusUpdateLocal(selectedOrder.status);
    setShowManualRefund(false);
    setManualReference("");
    const review = selectedOrder.cancellationRefund;
    setCancelCharge(review && review.chargeAmount > 0 ? String(review.chargeAmount) : "");
    setCancelChargeReason(review?.chargeReason ?? "");
    setCancelManual("");
  }, [selectedOrder?.orderId, selectedOrder?.cancellationRefund?.status]);

  useEffect(() => {
    const itemId = selectedOrder?.orderId;
    if (!itemId) {
      setContinuations(null);
      return;
    }

    let cancelled = false;
    const load = () => {
      if (continuationsUpdating) return;
      adminApi
        .getAdminOrderContinuations(itemId)
        .then((row) => {
          if (!cancelled) setContinuations(row);
        })
        .catch((err) => {
          console.error("Failed to load continuations", err);
          if (!cancelled) setContinuations(null);
        });
    };

    load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedOrder?.orderId, continuationsUpdating]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-order-detail"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-order-summaries"] });
    queryClient.invalidateQueries({ queryKey: ["admin-alert-summary"] });
    queryClient.invalidateQueries({ queryKey: ["admin-alert-feed"] });
  };

  const cancellationRefundMutation = useMutation({
    mutationFn: (reference?: string) => {
      if (!selectedOrder) throw new Error("Select a product first.");
      const charge = Number(cancelCharge || 0);
      return adminApi.refundOrderCancellation(
        selectedOrder.orderId,
        Number.isFinite(charge) ? charge : 0,
        cancelChargeReason,
        reference,
      );
    },
    onSuccess: () => {
      toast.success("Cancellation refund recorded for this product.");
      setCancelManual("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "Refund failed."),
  });

  const refundMutation = useMutation({
    mutationFn: (reference?: string) => {
      if (!selectedOrder) throw new Error("Select a product first.");
      return adminApi.refundOrderDeposit(selectedOrder.orderId, reference);
    },
    onSuccess: () => {
      toast.success("Deposit refund recorded for this product.");
      setManualReference("");
      setShowManualRefund(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "Refund failed."),
  });

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

  if (isLoading && !selectedOrder) {
    return <PageLoaderSlot />;
  }

  if (!selectedOrder) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <BackLink to="/admin/orders" label="Back to orders" />
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const hasPendingContinuations = Boolean(
    continuations &&
      (continuations.pendingExtensions.length > 0 || continuations.pendingBuyouts.length > 0),
  );
  const refundAlreadySent = ["refunded", "refunding", "settled"].includes(
    selectedOrder.cancellationRefund?.status ?? "",
  );
  const canChangeStatus = getAvailableStatuses(selectedOrder.status, selectedOrder.orderType)
    .some((id) => id !== selectedOrder.status);
  const canReassign = selectedOrder.status === "dispatch_failed" && !refundAlreadySent;
  const showAdminActions = canChangeStatus || canReassign;

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <BackLink to="/admin/orders" label="Back to orders" />

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
              {payableGroupItems.length > 0 ? (
                <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  Vendor payout ₹{groupVendorPayout.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </p>
              ) : null}
              {orderGroupItems.some((item) => item.vendorPriceSetByAdmin === false) ? (
                <span className="mt-2 inline-flex w-fit rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                  Vendor price not set
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items picker */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-4">
          <p className="text-lg font-semibold">Items in this Order</p>
          <p className="text-xs text-muted-foreground">
            Select an item to view its timeline, vendor assignment, and admin actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
          {orderGroupItems.map((item) => {
            const isSelected = item.orderId === selectedOrder.orderId;
            const imageUrl = resolveItemImageUrl(item);
            return (
              <button
                key={item.orderId}
                type="button"
                onClick={() => setSelectedItemId(item.orderId)}
                className={cn(
                  "flex w-full min-w-0 flex-col overflow-hidden rounded-lg border p-3 text-left transition-all sm:flex-row sm:items-center sm:justify-between",
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
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">
                      <span>Qty: {item.quantity}</span>
                      <span className="mt-0.5 block break-all tabular-nums sm:ml-2 sm:mt-0 sm:inline">· {item.orderNumber}</span>
                      <span className="mt-0.5 block break-words sm:ml-2 sm:mt-0 sm:inline">· {item.vendorName}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex w-full min-w-0 items-center justify-between gap-2 sm:mt-0 sm:w-auto sm:justify-end sm:gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {item.isExtended ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      EXTENDED
                    </span>
                  ) : null}
                  {adminRefundChip(item.returnSettlement) ? (
                    <span className="max-w-full whitespace-normal rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold leading-snug text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                      {adminRefundChip(item.returnSettlement)}
                    </span>
                  ) : null}
                  {adminCancellationChip(item.cancellationRefund) ? (
                    <span className="max-w-full whitespace-normal rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold leading-snug text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                      {adminCancellationChip(item.cancellationRefund)}
                    </span>
                  ) : null}
                  <Badge
                    title={formatOrderStatusTitle(item.status)}
                    className={cn("shrink-0", orderStatusBadgeSizeClass, orderStatusBadgeClass(item.status))}
                    variant="outline"
                  >
                    {formatOrderStatusLabel(item.status)}
                  </Badge>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Rent Extension</p>
                  <p className="text-sm text-muted-foreground">+{ext.additionalDays} day{ext.additionalDays === 1 ? "" : "s"}</p>
                  <div className="mt-2 grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <p className="text-muted-foreground">Original end</p>
                    <p className="text-right">{formatDetailDate(ext.originalEndDate)}</p>
                    <p className="text-muted-foreground">New end</p>
                    <p className="text-right">{formatDetailDate(ext.newEndDate)}</p>
                    <p className="col-span-2 my-0.5 border-t border-amber-200/70" />
                    <p className="text-muted-foreground">Customer extension rent</p>
                    <p className="text-right">₹{ext.extensionAmount.toFixed(2)}</p>
                    <p className="text-muted-foreground">{formatGstRateLabel(ext.gstPercent)}</p>
                    <p className="text-right">₹{ext.gstAmount.toFixed(2)}</p>
                    <p className="font-semibold">Customer total</p>
                    <p className="text-right font-semibold">₹{ext.totalAmount.toFixed(2)}</p>
                    <p className="font-semibold text-amber-900 dark:text-amber-400">Vendor payout</p>
                    <p className="text-right font-semibold text-amber-900 dark:text-amber-400">₹{extensionVendorPayout(ext).toFixed(2)}</p>
                  </div>
                </div>
                {ext.status === "awaiting_payment" ? (
                  <p className="text-sm text-amber-900 dark:text-amber-300 sm:max-w-[16rem] sm:text-right">
                    Approved. The customer still has to pay. The end date stays the same until then.
                  </p>
                ) : (
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
                        "Extension approved. The customer pays before the end date changes.",
                      )
                    }
                  >
                    Approve
                  </Button>
                </div>
                )}
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

      {showAdminActions ? (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Admin actions</p>
              <p className="text-xs text-muted-foreground">Applies to the selected item only.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedOrder.status === "dispatch_failed" && !refundAlreadySent && (
                <TooltipProvider>
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full sm:w-auto" disabled={restartDispatchMutation.isPending}>
                            {restartDispatchMutation.isPending ? "Reassigning..." : "Reassign Order"}
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-center" side="top">
                        Sends a new offer before the refund is paid. The open refund review is closed if a vendor is found.
                      </TooltipContent>
                    </Tooltip>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reassign Order?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The system will send a new offer to the nearest eligible vendor, then the next if they do not accept.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => restartDispatchMutation.mutate()}>Reassign</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TooltipProvider>
              )}

              {canChangeStatus ? (
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
              ) : null}
            </CardContent>
          </Card>
          ) : null}

      <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)]">
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

        <div className="flex flex-col gap-4 sm:gap-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-lg font-semibold">Customer</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> Name
                </p>
                <p className="font-medium">{selectedOrder.customerName}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.customerEmail}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            <CardContent className="flex flex-col p-0">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-6 pb-4 text-sm">
                {selectedOrder.orderType?.toLowerCase() === "buy" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchase date</p>
                      <p className="font-medium tabular-nums">{formatDetailDate(selectedOrder.startDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order type</p>
                      <p className="font-medium">Buy</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start date</p>
                      <p className="font-medium tabular-nums">{formatDetailDate(selectedOrder.startDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">End date</p>
                        {selectedOrder.isExtended ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            EXTENDED
                          </span>
                        ) : null}
                      </div>
                      <p className="font-medium tabular-nums">{formatDetailDate(selectedOrder.endDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental period</p>
                      <p className="font-medium">
                        {selectedOrder.rentalDurationLabel?.trim() || `${selectedOrder.rentalDays} days`}
                      </p>
                      {selectedOrder.rentalDurationLabel?.trim() && selectedOrder.rentalDurationDays ? (
                        <p className="text-xs text-muted-foreground">
                          {selectedOrder.rentalDurationDays} day{selectedOrder.rentalDurationDays === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order type</p>
                      <p className="font-medium">Rent</p>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantity</p>
                  <p className="font-medium">{selectedOrder.quantity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</p>
                  <p className="font-semibold tabular-nums">₹{selectedOrder.totalAmount.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    + ₹{selectedOrder.depositAmount.toFixed(0)} deposit
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatGstRateLabel(selectedOrder.gstPercent)} ₹{(selectedOrder.gstAmount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {orderShowsVendorPayout(selectedOrder.status) ? (
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 bg-muted/40 px-6 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor payout</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    ₹{(selectedOrder.vendorSubtotalAmount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              ) : null}
              {selectedOrder.vendorPriceSetByAdmin === false ? (
                <div className="px-6 pb-4">
                  <span className="inline-flex w-fit rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                    Vendor price not set
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

          {selectedOrder.returnSettlement ? (
            <Card className="min-w-0 overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">Deposit refund</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This product only. Rent, GST, and fees stay with the order.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      selectedOrder.returnSettlement.status === "refunded"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : selectedOrder.returnSettlement.refundAmount > 0
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {selectedOrder.returnSettlement.status === "refunded"
                      ? "Refund sent"
                      : selectedOrder.returnSettlement.refundAmount > 0
                        ? "Waiting for refund"
                        : "No refund"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 text-sm sm:p-6">
                {selectedOrder.returnSettlement.status === "refunded" ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <p className="font-semibold">Refund sent to the customer</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      ₹{formatInr(selectedOrder.returnSettlement.refundAmount)}
                      {selectedOrder.returnSettlement.refundedAt
                        ? ` on ${new Date(selectedOrder.returnSettlement.refundedAt).toLocaleString()}`
                        : ""}
                      {selectedOrder.returnSettlement.refundReference
                        ? ` · ${selectedOrder.returnSettlement.refundReference}`
                        : ""}
                    </p>
                  </div>
                ) : selectedOrder.returnSettlement.refundAmount > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">
                      Waiting for you to refund ₹{formatInr(selectedOrder.returnSettlement.refundAmount)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      The vendor marked this product returned. Check the reason and photos, then send this amount back.
                    </p>
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Deposit</p>
                    <p className="font-medium tabular-nums">₹{formatInr(selectedOrder.returnSettlement.depositAmount)}</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Damage claim</p>
                    <p className="font-medium tabular-nums">₹{formatInr(selectedOrder.returnSettlement.damageAmount)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium">Refund to customer</p>
                    <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      ₹{formatInr(selectedOrder.returnSettlement.refundAmount)}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "grid gap-4",
                  selectedOrder.returnSettlement.damageReason && damagePhotoUrls.length > 0 && "lg:grid-cols-2 lg:items-start",
                )}>
                  {selectedOrder.returnSettlement.damageReason ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor wrote</p>
                      <p className="rounded-lg border border-border/70 px-3 py-2 leading-relaxed">
                        {selectedOrder.returnSettlement.damageReason}
                      </p>
                    </div>
                  ) : null}
                  {damagePhotoUrls.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Damage photos · tap to enlarge
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                        {damagePhotoUrls.map((url, index) => (
                          <button
                            key={mediaObjectKey(url)}
                            type="button"
                            className="aspect-square w-full min-w-0 overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-black/[0.06] dark:ring-white/10 sm:aspect-auto sm:h-28 sm:w-28"
                            onClick={() => setDamagePreviewUrl(url)}
                            aria-label={`Damage photo ${index + 1}`}
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : selectedOrder.returnSettlement.damageAmount > 0 ? (
                    <p className="text-xs text-muted-foreground">The vendor did not add photos with this claim.</p>
                  ) : null}
                </div>
                {selectedOrder.returnSettlement.status === "refunded" ? null : selectedOrder.returnSettlement.refundAmount <= 0 ? (
                  <p className="text-muted-foreground">
                    {selectedOrder.returnSettlement.damageAmount > 0
                      ? "No refund. The damage charge uses this product's full deposit."
                      : "No security deposit on this product."}
                  </p>
                ) : refundMutation.isPending ? (
                  <p className="text-muted-foreground">Sending this refund…</p>
                ) : (
                  <div className="space-y-3">
                    {selectedOrder.returnSettlement.status === "refunding" ? (
                      <p className="text-muted-foreground">
                        This refund was started. If the customer was already paid, mark it paid with the reference.
                      </p>
                    ) : null}
                    {selectedOrder.returnSettlement.hasOnlinePayment
                      && selectedOrder.returnSettlement.status !== "refunding"
                      && !showManualRefund ? (
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={refundMutation.isPending}
                        onClick={() => refundMutation.mutate(undefined)}
                      >
                        Refund ₹{formatInr(selectedOrder.returnSettlement.refundAmount)} through Razorpay
                      </Button>
                    ) : null}
                    {showManualRefund || !selectedOrder.returnSettlement.hasOnlinePayment || selectedOrder.returnSettlement.status === "refunding" ? (
                      <div className="max-w-xl space-y-2 rounded-lg border border-dashed border-border px-3 py-3">
                        <p className="text-sm font-medium">Already paid the customer another way?</p>
                        <p className="text-xs text-muted-foreground">
                          Use this after a UPI, bank, or Razorpay dashboard refund. This does not send money.
                        </p>
                        <Input
                          value={manualReference}
                          onChange={(event) => setManualReference(event.target.value)}
                          placeholder="UPI, bank, or Razorpay reference"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={refundMutation.isPending || !manualReference.trim()}
                          onClick={() => refundMutation.mutate(manualReference.trim())}
                        >
                          Save manual refund
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="ghost" className="h-auto px-0" onClick={() => setShowManualRefund(true)}>
                        Already paid another way?
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Dialog open={!!damagePreviewUrl} onOpenChange={(open) => !open && setDamagePreviewUrl(null)}>
            <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
              <DialogHeader className="border-b border-border px-4 py-3 pr-12">
                <DialogTitle className="text-sm font-semibold">Damage photo</DialogTitle>
              </DialogHeader>
              {damagePreviewUrl ? (
                <ZoomableImageStage src={damagePreviewUrl} alt="Damage photo" resetKey={damagePreviewUrl} />
              ) : null}
            </DialogContent>
          </Dialog>

          {selectedOrder.cancellationRefund ? (
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-lg font-semibold">Cancellation refund</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.cancellationRefund.actorLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Deduct a charge only if needed, then refund this product.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <CancellationRefundBody
                  row={selectedOrder.cancellationRefund}
                  chargeText={cancelCharge}
                  reason={cancelChargeReason}
                  manual={cancelManual}
                  pending={cancellationRefundMutation.isPending}
                  onCharge={setCancelCharge}
                  onReason={setCancelChargeReason}
                  onManual={setCancelManual}
                  onSubmit={(reference) => cancellationRefundMutation.mutate(reference)}
                />
              </CardContent>
            </Card>
          ) : null}

          <OrderPrescriptionFilesCard files={prescriptionFiles} />
    </div>
  );
};

export default AdminOrderDetail;
