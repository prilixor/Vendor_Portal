import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Barcode, CheckCircle2, Stethoscope } from "lucide-react";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
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
import { VendorDoctorLookupDialog } from "@/app/components/vendor/VendorDoctorLookupDialog";
import { OrderMedicalReferenceCard } from "@/app/components/shared/OrderMedicalReferenceCard";

const filterAssetsForOrder = (
  assets: VendorProductAssetApiDto[],
  listingId: string,
  productVariantId?: string,
) =>
  assets.filter((asset) => {
    if (asset.vendorProductListingId !== listingId) return false;
    if (asset.status.trim().toLowerCase() !== "available") return false;
    if (productVariantId && asset.productVariantId && asset.productVariantId !== productVariantId) {
      return false;
    }
    return true;
  });

const normalizeAssetTag = (tag: string) => tag.trim().toLowerCase();

const getUsedAssetTags = (tags: string[], excludeIndex: number) =>
  new Set(
    tags
      .map((tag, index) => (index === excludeIndex ? "" : tag))
      .map(normalizeAssetTag)
      .filter(Boolean),
  );

const filterAvailableAssets = (
  assets: VendorProductAssetApiDto[],
  usedTags: Set<string>,
  query: string,
) => {
  const q = query.trim().toLowerCase();
  return assets.filter((asset) => {
    const tag = normalizeAssetTag(asset.assetTag);
    if (usedTags.has(tag)) return false;
    if (q && !tag.includes(q)) return false;
    return true;
  });
};

const countRemainingAssets = (assets: VendorProductAssetApiDto[], tags: string[]) => {
  const used = new Set(tags.map(normalizeAssetTag).filter(Boolean));
  return assets.filter((asset) => !used.has(normalizeAssetTag(asset.assetTag))).length;
};

const hasDuplicateAssetTags = (tags: string[]) => {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeAssetTag(tag);
    if (!normalized) continue;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
  }
  return false;
};

const AssignedSerialNumbersCard = ({ tags }: { tags: string[] }) => {
  const assigned = tags.map((tag) => tag.trim()).filter(Boolean);
  if (assigned.length === 0) return null;

  return (
    <Card className="border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">Assigned serial numbers</p>
              <p className="text-xs text-muted-foreground mt-1">
                Linked to this line item for dispatch and inventory tracking.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
            {assigned.length} {assigned.length === 1 ? "unit" : "units"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-2 sm:grid-cols-2">
          {assigned.map((tag, idx) => (
            <div
              key={`${tag}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-xs font-semibold text-muted-foreground">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Serial</p>
                <p className="font-mono text-sm font-semibold truncate" title={tag}>
                  {tag}
                </p>
              </div>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const AssignedSerialNumbersList = ({ tags }: { tags: string[] }) => {
  const assigned = tags.map((tag) => tag.trim()).filter(Boolean);
  if (assigned.length === 0) return null;

  return (
    <div className="grid gap-2">
      {assigned.map((tag, idx) => (
        <div
          key={`${tag}-${idx}`}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-xs font-semibold text-muted-foreground">
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Item {idx + 1}</p>
            <p className="font-mono text-sm font-semibold truncate">{tag}</p>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
      ))}
    </div>
  );
};

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

function getBaseOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").slice(0, 3).join("-");
}

function itemPayout(item: VendorOrderApiDto): number {
  return item.vendorSubtotalAmount && item.vendorSubtotalAmount > 0
    ? item.vendorSubtotalAmount
    : item.totalAmount;
}

const VendorOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [order, setOrder] = useState<VendorOrderApiDto | null>(null);
  const [allOrders, setAllOrders] = useState<VendorOrderApiDto[]>([]);
  const [continuations, setContinuations] = useState<OrderContinuationsDto | null>(null);

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchAssetTags, setDispatchAssetTags] = useState<string[]>([]);
  const [availableAssets, setAvailableAssets] = useState<VendorProductAssetApiDto[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<number, boolean>>({});
  const [doctorLookupOpen, setDoctorLookupOpen] = useState(false);
  const [doctorLookupCode, setDoctorLookupCode] = useState("");

  const currentItemId = selectedItemId || orderId;

  useEffect(() => {
    setSelectedItemId(null);
  }, [orderId]);

  const loadOrder = async (itemId?: string | null) => {
    const id = itemId ?? currentItemId;
    if (!user || !id) return;
    try {
      setLoading(true);
      const row = await vendorOnboardingApi.getVendorOrder(user.id, id);
      setOrder(row);
      try {
        const conts = await vendorOnboardingApi.getVendorOrderContinuations(id);
        setContinuations(conts);
      } catch (err) {
        console.error("Failed to load continuations", err);
        setContinuations(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load order detail.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllOrders = async () => {
    if (!user) return;
    try {
      const rows = await vendorOnboardingApi.getVendorOrders(user.id);
      setAllOrders(rows);
    } catch (error) {
      console.error("Failed to load vendor orders for grouping", error);
    }
  };

  useEffect(() => {
    void loadOrder(currentItemId);
  }, [user?.id, currentItemId]);

  useEffect(() => {
    void loadAllOrders();
  }, [user?.id]);

  const orderGroupItems = useMemo(() => {
    if (!order) return [];
    const baseNum = getBaseOrderNumber(order.orderNumber);
    if (!baseNum) return [order];
    const matches = allOrders.filter(
      (o) => o.orderNumber && getBaseOrderNumber(o.orderNumber) === baseNum,
    );
    if (matches.length === 0) return [order];
    const hasCurrent = matches.some((o) => o.orderId === order.orderId);
    const items = hasCurrent
      ? matches
      : [order, ...matches.filter((o) => o.orderId !== order.orderId)];
    return [...items].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));
  }, [order, allOrders]);

  const groupPayoutAmount = useMemo(
    () => orderGroupItems.reduce((sum, item) => sum + itemPayout(item), 0),
    [orderGroupItems],
  );

  const baseOrderNumber = useMemo(
    () => (order?.orderNumber ? getBaseOrderNumber(order.orderNumber) : ""),
    [order],
  );

  const activeOrder = useMemo(
    () => orderGroupItems.find((item) => item.orderId === currentItemId) ?? order,
    [orderGroupItems, currentItemId, order],
  );

  const resetDispatchState = useCallback(() => {
    setDispatchAssetTags([]);
    setAvailableAssets([]);
    setOpenDropdowns({});
    setLoadingAssets(false);
  }, []);

  const loadDispatchAssets = useCallback(
    async (listingId: string, productVariantId?: string) => {
      if (!user) return;
      setLoadingAssets(true);
      setAvailableAssets([]);
      try {
        const data = await vendorOnboardingApi.getVendorProductAssets(user.id, listingId);
        setAvailableAssets(filterAssetsForOrder(data, listingId, productVariantId));
      } catch (error) {
        console.error("Failed to load dispatch assets", error);
        setAvailableAssets([]);
      } finally {
        setLoadingAssets(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!dispatchDialogOpen || !activeOrder || !user) return;

    const existingTags = (activeOrder.assignedAssetTags ?? []).filter((tag) => tag.trim() !== "");
    setDispatchAssetTags(
      existingTags.length > 0 ? existingTags : new Array(activeOrder.quantity).fill(""),
    );
    setOpenDropdowns({});

    if (existingTags.length > 0) {
      setAvailableAssets([]);
      setLoadingAssets(false);
      return;
    }

    void loadDispatchAssets(activeOrder.listingId, activeOrder.productVariantId);
  }, [
    dispatchDialogOpen,
    activeOrder?.orderId,
    activeOrder?.listingId,
    activeOrder?.productVariantId,
    activeOrder?.quantity,
    activeOrder?.assignedAssetTags,
    user?.id,
    loadDispatchAssets,
  ]);

  const handleDispatchDialogChange = (open: boolean) => {
    setDispatchDialogOpen(open);
    if (!open) resetDispatchState();
  };

  const handleSelectItem = (itemId: string) => {
    if (itemId === currentItemId) return;
    handleDispatchDialogChange(false);
    const fromList = allOrders.find((o) => o.orderId === itemId);
    if (fromList) {
      setOrder(fromList);
      setContinuations(null);
    }
    setSelectedItemId(itemId);
  };

  const handleStatusChange = async (status: "in_transit" | "active" | "returned") => {
    const dispatchOrder = activeOrder ?? order;
    if (!dispatchOrder) return;

    const existingTags = (dispatchOrder.assignedAssetTags ?? []).filter((t) => t.trim() !== "");

    if (status === "in_transit" && !dispatchDialogOpen) {
      setDispatchDialogOpen(true);
      return;
    }

    if (!user || !currentItemId) return;

    const tagsToAssign =
      status === "in_transit" || status === "active"
        ? existingTags.length > 0
          ? []
          : dispatchAssetTags.filter((t) => t.trim() !== "")
        : [];

    if (tagsToAssign.length > 0 && hasDuplicateAssetTags(tagsToAssign)) {
      toast.error("Each item needs a unique serial number. Remove duplicates and try again.");
      return;
    }

    try {
      setUpdating(true);
      const assetTagsToSubmit =
        status === "in_transit" || status === "active"
          ? existingTags.length > 0
            ? undefined
            : tagsToAssign
          : undefined;
      await vendorOnboardingApi.updateVendorOrderStatus(user.id, currentItemId, status, assetTagsToSubmit);
      toast.success("Order status updated.");
      handleDispatchDialogChange(false);
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status.";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !currentItemId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelAssignedVendorOrder(user.id, currentItemId);
      toast.success("Order cancelled and reassigned.");
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel order.";
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const hasPendingRequests = Boolean(continuations && (continuations.pendingExtensions.length > 0 || continuations.pendingBuyouts.length > 0));

  const isDetailSynced = Boolean(order && order.orderId === currentItemId);
  const actionsLocked = updating || loading || !isDetailSynced;

  const normalizedStatus = order?.status.trim().toLowerCase() ?? "";
  const canMarkTransit = normalizedStatus === "confirmed" && !hasPendingRequests;
  const canMarkActive = (normalizedStatus === "in transit" || normalizedStatus === "in_transit") && !hasPendingRequests;
  const canMarkReturned = normalizedStatus === "active" && order?.orderType.toLowerCase() !== "buy" && !hasPendingRequests;
  const canCancel = normalizedStatus === "confirmed" && !hasPendingRequests;

  const handleCancelBuyout = async (buyoutId: string) => {
    if (!currentItemId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelVendorBuyout(currentItemId, buyoutId);
      toast.success("Buyout request cancelled.");
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApproveBuyout = async (buyoutId: string) => {
    if (!currentItemId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.approveVendorBuyout(currentItemId, buyoutId);
      toast.success("Buyout request approved.");
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelExtension = async (extensionId: string) => {
    if (!currentItemId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.cancelVendorExtension(currentItemId, extensionId);
      toast.success("Extension request cancelled.");
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleApproveExtension = async (extensionId: string) => {
    if (!currentItemId) return;
    try {
      setUpdating(true);
      await vendorOnboardingApi.approveVendorExtension(currentItemId, extensionId);
      toast.success("Extension request approved.");
      await Promise.all([loadOrder(currentItemId), loadAllOrders()]);
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
        {!order ? (
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        ) : (
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="relative min-w-0 flex-1 space-y-2 lg:pr-8">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Group</p>
                <h1 className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{baseOrderNumber}</h1>
                <p className="text-sm text-muted-foreground">Consolidated fulfillment overview</p>
              </div>
              <div className="flex shrink-0 flex-col items-start border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  ₹{groupPayoutAmount.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                  Estimated Vendor Payout{orderGroupItems.length > 1 ? " (Combined)" : ""}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {order && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-4">
            <p className="text-lg font-semibold">Items in this Order</p>
            <p className="text-xs text-muted-foreground">
              Select an item below to track its individual timeline and fulfill actions.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderGroupItems.map((item) => {
              const isSelected = item.orderId === currentItemId;
              const imageUrl = resolveItemImageUrl(item);
              return (
                <button
                  key={item.orderId}
                  type="button"
                  onClick={() => handleSelectItem(item.orderId)}
                  className={cn(
                    "w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border transition-all",
                    isSelected
                      ? "bg-accent/40 border-foreground/60 shadow-sm"
                      : "bg-transparent border-border/60 hover:bg-accent/20",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.listingTitle}
                        className="h-10 w-10 rounded-md object-cover border border-border/40 bg-muted"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted border border-border/40 flex items-center justify-center text-[10px] text-muted-foreground">
                        No Img
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.listingTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: {item.quantity}
                        {item.orderNumber.includes("-") ? (
                          <span className="ml-2 tabular-nums">· {item.orderNumber}</span>
                        ) : null}
                      </p>
                      {item.assignedAssetTags && item.assignedAssetTags.length > 0 ? (
                        <p className="mt-1.5 text-[10px] font-medium text-primary">
                          {item.assignedAssetTags.length} serial number
                          {item.assignedAssetTags.length === 1 ? "" : "s"} assigned
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        orderStatusBadgeClass(item.status),
                      )}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold tabular-nums text-xs sm:w-20 sm:text-right">
                      ₹{itemPayout(item).toFixed(0)}
                    </span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {order && (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Next step</p>
              <p className="text-sm text-muted-foreground">
                Move the selected item forward when you've completed the required operation.
              </p>
            </div>
            {nextAction ? (
              <Button onClick={() => nextAction.action && void nextAction.action()} disabled={actionsLocked || nextAction.disabled}>
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

      {order && (
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
                        {/* Service fee UI hidden — keep for future re-enable */}
                        {false && (
                          <>
                            <p className="text-muted-foreground">Service Fee:</p>
                            <p className="text-right">₹{ext.serviceFeeAmount.toFixed(2)}</p>
                          </>
                        )}
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
                        {/* Service fee UI hidden — keep for future re-enable */}
                        {false && (
                          <>
                            <p className="text-muted-foreground">Service Fee:</p>
                            <p className="text-right">₹{buy.serviceFeeAmount.toFixed(2)}</p>
                          </>
                        )}
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
              <p className="text-xs text-muted-foreground mt-0.5">
                Tracking: <span className="font-semibold text-foreground">{order.listingTitle}</span>
              </p>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rental period</p>
                    <p className="text-sm font-medium">
                      {order.rentalDurationLabel
                        ? `${order.rentalDurationLabel}${
                            order.rentalDurationDays
                              ? ` (${order.rentalDurationDays} day${order.rentalDurationDays === 1 ? "" : "s"})`
                              : ""
                          }`
                        : (
                          <>
                            {order.rentalDays}{" "}
                            {order.rentalPeriodUnit === "week"
                              ? order.rentalDays === 1
                                ? "week"
                                : "weeks"
                              : order.rentalPeriodUnit === "month"
                                ? order.rentalDays === 1
                                  ? "month"
                                  : "months"
                                : order.rentalDays === 1
                                  ? "day"
                                  : "days"}
                          </>
                        )}
                    </p>
                    {order.rentalFinalPrice != null ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {order.rentalNormalPrice != null &&
                        Number(order.rentalNormalPrice) > Number(order.rentalFinalPrice) ? (
                          <>
                            <span className="line-through">₹{Number(order.rentalNormalPrice).toFixed(0)}</span>{" "}
                          </>
                        ) : null}
                        Plan price ₹{Number(order.rentalFinalPrice).toFixed(0)}
                      </p>
                    ) : null}
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

          {order.assignedAssetTags && order.assignedAssetTags.length > 0 && (
            <AssignedSerialNumbersCard tags={order.assignedAssetTags} />
          )}

          {/* Medical Reference */}
          {(order.doctorId || order.hospitalId || order.doctorName || order.doctorUniqueCode) && (
            <OrderMedicalReferenceCard
              doctorName={order.doctorName}
              doctorSpecialization={order.doctorSpecialization}
              doctorUniqueCode={order.doctorUniqueCode}
              doctorContactNumber={order.doctorContactNumber}
              hospitalName={order.hospitalName}
              hospitalCity={order.hospitalCity}
              action={
                order.doctorUniqueCode ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setDoctorLookupCode(order.doctorUniqueCode || "");
                      setDoctorLookupOpen(true);
                    }}
                  >
                    <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                    View doctor
                  </Button>
                ) : null
              }
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{order.orderType.toUpperCase()}</Badge>
            <Button variant="outline" disabled={!canMarkTransit || actionsLocked} onClick={() => void handleStatusChange("in_transit")}>
              Mark In Transit
            </Button>
            <Button variant="outline" disabled={!canMarkActive || actionsLocked} onClick={() => void handleStatusChange("active")}>
              Mark Delivered
            </Button>
            <Button variant="outline" disabled={!canMarkReturned || actionsLocked} onClick={() => void handleStatusChange("returned")}>
              Mark Returned
            </Button>
            <Button variant="destructive" disabled={!canCancel || actionsLocked} onClick={() => void handleCancel()}>
              Cancel & Reassign
            </Button>
          </div>
        </>
      )}

      <Dialog open={dispatchDialogOpen} onOpenChange={handleDispatchDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispatch Details</DialogTitle>
            {activeOrder ? (
              <p className="text-xs text-muted-foreground pt-1">{activeOrder.listingTitle}</p>
            ) : null}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(activeOrder?.assignedAssetTags ?? []).filter((t) => t.trim() !== "").length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  These serial numbers are already assigned to this item. Review them and confirm dispatch.
                </p>
                <AssignedSerialNumbersList tags={activeOrder?.assignedAssetTags ?? []} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Enter serial numbers or asset tags for {activeOrder?.quantity ?? 1}{" "}
                  {(activeOrder?.quantity ?? 1) === 1 ? "item" : "items"} being dispatched. Optional —
                  pick from this product&apos;s registered stock or type new ones.
                </p>
                {loadingAssets ? (
                  <p className="text-sm">Loading available stock for this product...</p>
                ) : (
                  <div className="space-y-3">
                    {availableAssets.length > 0 ? (
                      <p className="text-xs font-medium text-primary">
                        {countRemainingAssets(availableAssets, dispatchAssetTags)} of {availableAssets.length}{" "}
                        serial number(s) still available for {activeOrder?.listingTitle}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No pre-registered stock for this product. You can type a serial or batch number, or leave blank.
                      </p>
                    )}
                    {dispatchAssetTags.map((tag, idx) => {
                      const query = tag.trim().toLowerCase();
                      const usedTags = getUsedAssetTags(dispatchAssetTags, idx);
                      const matchingAssets = filterAvailableAssets(availableAssets, usedTags, query);
                      const isOpen = openDropdowns[idx] && matchingAssets.length > 0;

                      return (
                        <div key={`${activeOrder?.orderId ?? "dispatch"}-${idx}`} className="space-y-1.5 relative">
                          <Label>Item {idx + 1} Serial Number (Optional)</Label>
                          <Input
                            placeholder={
                              availableAssets.length > 0
                                ? "Enter or select serial number..."
                                : "Enter serial or batch number (optional)..."
                            }
                            value={tag}
                            onChange={(e) => {
                              const newTags = [...dispatchAssetTags];
                              newTags[idx] = e.target.value;
                              setDispatchAssetTags(newTags);
                              setOpenDropdowns({ ...openDropdowns, [idx]: true });
                            }}
                            onFocus={() => {
                              if (availableAssets.length > 0) {
                                setOpenDropdowns({ ...openDropdowns, [idx]: true });
                              }
                            }}
                            onBlur={() => setTimeout(() => setOpenDropdowns({ ...openDropdowns, [idx]: false }), 150)}
                          />
                          {isOpen ? (
                            <div className="absolute top-full left-0 z-[100] mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                              {matchingAssets.map((a) => (
                                <div
                                  key={a.id}
                                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const newTags = [...dispatchAssetTags];
                                    newTags[idx] = a.assetTag;
                                    setDispatchAssetTags(newTags);
                                    setOpenDropdowns({ ...openDropdowns, [idx]: false });
                                  }}
                                >
                                  {a.assetTag}
                                  {a.variantLabel ? (
                                    <span className="ml-2 text-xs text-muted-foreground">{a.variantLabel}</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : openDropdowns[idx] && availableAssets.length > 0 && usedTags.size > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              All remaining serial numbers are already assigned to other items.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleStatusChange("in_transit")} disabled={updating || loadingAssets}>
              Confirm Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VendorDoctorLookupDialog
        open={doctorLookupOpen}
        onOpenChange={setDoctorLookupOpen}
        initialCode={doctorLookupCode}
      />
    </div>
  );
};

export default VendorOrderDetail;
