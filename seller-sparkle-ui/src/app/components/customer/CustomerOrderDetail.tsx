import { useParams, Link } from "react-router-dom";
import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckSquare, Headset, Images, Loader2, MessageCircle, Package } from "lucide-react";
import {
  customerApi,
  type CustomerOrderImageApi,
  type CustomerOrderImageRequestApi,
} from "@/app/services/customerApi";
import { chatApi } from "@/app/services/chatApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import { OrderMedicalReferenceCard } from "@/app/components/shared/OrderMedicalReferenceCard";
import { BackLink } from "@/app/components/shared/BackLink";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ZoomableImageStage } from "@/app/components/shared/ZoomableImageStage";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/app/components/ui/sheet";
import { Input } from "@/app/components/ui/input";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { ChatDaySeparator } from "@/app/components/shared/ChatDaySeparator";
import { toast } from "sonner";
import { isSameChatDay } from "@/app/helpers/chatDayLabel";
import { formatCustomerOrderStatusTitle, formatOrderStatusLabel, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, originalUrlFromThumb, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import type { ExtensionQuoteApi, BuyoutQuoteApi } from "@/app/services/customerApi";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending" || s === "awaiting vendor acceptance" || s === "pending vendor acceptance") {
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
  if (s === "bought out") {
    return "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-medium shadow-sm border-0 dark:from-fuchsia-600 dark:to-purple-700";
  }
  return "bg-muted text-foreground";
}

function customerFacingStatus(status: string): string {
  return formatCustomerOrderStatusTitle(status);
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

const MAX_ORDER_IMAGES = 5;

function orderStatusCompact(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Photo request is only meaningful once a fulfilling vendor is assigned. */
function canRequestOrderImages(status: string): boolean {
  const compact = orderStatusCompact(status);
  return compact === "pending" || compact === "confirmed" || compact === "in_transit";
}

function isAwaitingVendorForPhotos(status: string): boolean {
  const compact = orderStatusCompact(status);
  return (
    compact === "awaiting_vendor_acceptance" ||
    compact === "pending_vendor_acceptance"
  );
}

const getTimelineSteps = (orderType?: string) => {
  const isBuy = orderType?.toLowerCase() === "buy";
  if (isBuy) {
    return [
      { key: "placed", label: "Order Placed" },
      { key: "confirmed", label: "Supplier Confirmed" },
      { key: "out", label: "Out for Delivery" },
      { key: "active", label: "Delivered & Purchased" },
    ];
  }
  return [
    { key: "placed", label: "Order Placed" },
      { key: "confirmed", label: "Supplier Confirmed" },
    { key: "out", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
    { key: "active", label: "Rental Active" },
    { key: "returned", label: "Returned" },
  ];
};

/** Last step index fully completed (inclusive). `currentIndex` is the active step if any. */
function getTimelineProgress(status: string, orderType?: string): {
  cancelled: boolean;
  completedThrough: number;
  currentIndex: number | null;
} {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

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
    return isBuy
      ? { cancelled: false, completedThrough: 3, currentIndex: null }
      : { cancelled: false, completedThrough: 3, currentIndex: 4 };
  }
  if (compact === "returned") {
    return { cancelled: false, completedThrough: 5, currentIndex: null };
  }
  return { cancelled: false, completedThrough: 0, currentIndex: 1 };
}

function TimelineDot({
  isDone,
  isCurrent,
  isUpcoming,
  isRentalActiveCurrentStep,
  size,
}: {
  isDone: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
  isRentalActiveCurrentStep: boolean;
  size: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2",
        size === "sm" ? "h-[18px] w-[18px]" : "h-7 w-7",
        isDone && "border-foreground bg-foreground text-background",
        isCurrent && "border-foreground bg-background text-foreground shadow-sm",
        isRentalActiveCurrentStep && "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500",
        isUpcoming && "border-border bg-muted text-muted-foreground",
      )}
    >
      {isDone ? <Check className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} strokeWidth={2.5} /> : null}
      {isCurrent ? (
        <span
          className={cn("rounded-full bg-foreground", size === "sm" ? "h-1.5 w-1.5" : "h-1.5 w-1.5", isRentalActiveCurrentStep && "bg-white")}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

function OrderItemThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src?.trim() || failed) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/70"
        aria-hidden
      >
        <Package className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-11 w-11 shrink-0 rounded-lg border border-border/40 bg-muted object-cover"
      onError={(event) => {
        const el = event.currentTarget;
        if (el.dataset.thumbFallback === "1") {
          setFailed(true);
          return;
        }
        retryOriginalOnImageError(event);
        if (el.dataset.thumbFallback !== "1") {
          setFailed(true);
        }
      }}
    />
  );
}

function compactDurationLabel(label?: string | null): string {
  if (!label?.trim()) return "";
  return label
    .replace(/\s*Billing Cycles?/gi, " cycles")
    .replace(/\s*Billing Cycle/gi, " cycle")
    .trim();
}

function DetailRow({
  label,
  children,
  span,
  rowStart,
}: {
  label: string;
  children: ReactNode;
  span?: 2 | 3 | 4;
  rowStart?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-2 sm:block sm:space-y-1 sm:py-0",
        span === 2 && "sm:col-span-2",
        span === 3 && "sm:col-span-3",
        span === 4 && "sm:col-span-4",
        rowStart && "sm:border-t sm:border-border/60 sm:pt-4",
      )}
    >
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="min-w-0 text-right text-sm font-medium leading-snug sm:text-left">{children}</div>
    </div>
  );
}

function OrderTimeline({ status, orderType }: { status: string; orderType?: string }) {
  const { cancelled, completedThrough, currentIndex } = getTimelineProgress(status, orderType);

  if (cancelled) {
    return (
      <p className="text-sm text-muted-foreground">
        This order was cancelled — steps shown may have completed before cancellation.
      </p>
    );
  }

  const steps = getTimelineSteps(orderType);
  const isRentalActiveCurrent = currentIndex !== null && steps[currentIndex]?.key === "active" && orderType?.toLowerCase() !== "buy";

  return (
    <>
      {/* Mobile: sequential tracker (readable, compact). Desktop: horizontal stepper. */}
      <ol className="sm:hidden">
        {steps.map((step, i) => {
          const isDone = i <= completedThrough;
          const isCurrent = currentIndex === i;
          const isUpcoming = !isDone && !isCurrent;
          const isRentalActiveCurrentStep = isRentalActiveCurrent && step.key === "active";
          return (
            <li key={step.key} className="relative flex gap-3 pb-2.5 last:pb-0">
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "absolute left-[8px] top-[18px] h-[calc(100%-10px)] w-px",
                    isDone ? "bg-foreground/30" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <div className="relative z-10 mt-0.5">
                <TimelineDot
                  size="sm"
                  isDone={isDone}
                  isCurrent={isCurrent}
                  isUpcoming={isUpcoming}
                  isRentalActiveCurrentStep={isRentalActiveCurrentStep}
                />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    isRentalActiveCurrentStep && "text-emerald-700 dark:text-emerald-300",
                    isUpcoming ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {step.label}
                </p>
                {isCurrent ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">In progress</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <ol className="hidden sm:flex sm:items-start">
        {steps.map((step, i) => {
          const isDone = i <= completedThrough;
          const isCurrent = currentIndex === i;
          const isUpcoming = !isDone && !isCurrent;
          const isRentalActiveCurrentStep = isRentalActiveCurrent && step.key === "active";
          const filledLine = isDone || isCurrent;

          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-px min-w-[6px] flex-1",
                    i === 0 ? "bg-transparent" : filledLine ? "bg-foreground/30" : "bg-border",
                  )}
                  aria-hidden
                />
                <TimelineDot
                  size="md"
                  isDone={isDone}
                  isCurrent={isCurrent}
                  isUpcoming={isUpcoming}
                  isRentalActiveCurrentStep={isRentalActiveCurrentStep}
                />
                <div
                  className={cn(
                    "h-px min-w-[6px] flex-1",
                    i === steps.length - 1 ? "bg-transparent" : filledLine && i < completedThrough ? "bg-foreground/30" : "bg-border",
                  )}
                  aria-hidden
                />
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[11px] font-medium leading-tight",
                  isRentalActiveCurrentStep && "text-emerald-700 dark:text-emerald-300",
                  isUpcoming ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const CustomerOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionQuote, setExtensionQuote] = useState<ExtensionQuoteApi | null>(null);

  const [buyoutDialogOpen, setBuyoutDialogOpen] = useState(false);
  const [buyoutQuote, setBuyoutQuote] = useState<BuyoutQuoteApi | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [photoRequestSelection, setPhotoRequestSelection] = useState<string[]>([]);
  const [photoSelectionInitialized, setPhotoSelectionInitialized] = useState(false);

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

  const { data: chatSessions } = useQuery({
    queryKey: ["customer-chat-sessions"],
    queryFn: () => chatApi.getCustomerSessions(),
    enabled: isChatOpen,
  });

  const activeSession = useMemo(() => {
    if (!chatSessions || !data) return null;
    return (
      chatSessions.find(
        (s) => s.counterpartyType === "Admin" && s.orderId === data.id
      ) ||
      // Fallback for older sessions created before Admin routing
      chatSessions.find((s) => s.orderId === data.id) ||
      null
    );
  }, [chatSessions, data]);

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", activeSession?.id],
    queryFn: () => chatApi.getCustomerMessages(activeSession!.id),
    enabled: !!activeSession?.id && isChatOpen,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (isChatOpen && messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  const createSessionMut = useMutation({
    mutationFn: () => chatApi.createCustomerSession({
      vendorId: data!.vendorId,
      orderId: data!.id,
      subject: `Chat regarding order ${data!.orderNumber}: ${data!.listingTitle}`
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-chat-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to start chat with support.")
  });

  const sendMessageMut = useMutation({
    mutationFn: (text: string) => chatApi.sendCustomerMessage(activeSession!.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", activeSession?.id] });
      setNewMessageText("");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send message.")
  });

  const quoteExtensionMut = useMutation({
    mutationFn: (days: number) => customerApi.quoteExtension(activeItem!.id, days),
    onSuccess: (data) => setExtensionQuote(data),
    onError: (err: Error) => toast.error(err.message || "Failed to quote extension.")
  });

  const processExtensionMut = useMutation({
    mutationFn: () => customerApi.processExtension(activeItem!.id, extensionDays),
    onSuccess: () => {
      toast.success("Rental extension requested successfully! Pending approval.");
      setExtensionDialogOpen(false);
      setExtensionQuote(null);
      queryClient.invalidateQueries({ queryKey: ["customer-order", activeItem?.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to process extension.")
  });

  const quoteBuyoutMut = useMutation({
    mutationFn: () => customerApi.quoteBuyout(activeItem!.id),
    onSuccess: (data) => setBuyoutQuote(data),
    onError: (err: Error) => toast.error(err.message || "Failed to quote buyout.")
  });

  const processBuyoutMut = useMutation({
    mutationFn: () => customerApi.processBuyout(activeItem!.id),
    onSuccess: () => {
      toast.success("Item purchase requested successfully! Pending approval.");
      setBuyoutDialogOpen(false);
      setBuyoutQuote(null);
      queryClient.invalidateQueries({ queryKey: ["customer-order", activeItem?.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to process buyout.")
  });

  // Find all items belonging to the same order group prefix
  const orderGroupItems = useMemo(() => {
    if (!data || !allOrders) return data ? [data] : [];
    const baseNum = data.orderNumber?.split('-').slice(0, 3).join('-') || "";
    if (!baseNum) return data ? [data] : [];
    const matches = allOrders.filter((o) => o && o.orderNumber && o.orderNumber.split('-').slice(0, 3).join('-') === baseNum);
    return matches.length > 0 ? matches : (data ? [data] : []);
  }, [data, allOrders]);

  const groupItemIds = useMemo(() => orderGroupItems.map((item) => item.id), [orderGroupItems]);

  const imageRequestQueries = useQueries({
    queries: groupItemIds.map((itemId) => ({
      queryKey: ["customer-order-image-request", itemId],
      queryFn: () => customerApi.getOrderImageRequest(itemId),
      enabled: groupItemIds.length > 0,
    })),
  });

  const imageRequestLoading = imageRequestQueries.some((q) => q.isLoading || q.isFetching);
  /** True until every item's request status has been fetched at least once (avoid treating "unknown" as eligible). */
  const imageRequestsReady =
    groupItemIds.length === 0 ||
    imageRequestQueries.every((q) => q.isFetched || q.isError);
  const imageRequestsByItemId = useMemo(() => {
    const map = new Map<string, CustomerOrderImageRequestApi | null>();
    groupItemIds.forEach((itemId, index) => {
      map.set(itemId, imageRequestQueries[index]?.data ?? null);
    });
    return map;
  }, [groupItemIds, imageRequestQueries]);

  const photoEligibleItems = useMemo(
    () =>
      orderGroupItems.filter(
        (item) =>
          canRequestOrderImages(item.status) && !imageRequestsByItemId.get(item.id),
      ),
    [orderGroupItems, imageRequestsByItemId],
  );

  const itemsWithOpenRequest = useMemo(
    () => orderGroupItems.filter((item) => Boolean(imageRequestsByItemId.get(item.id))),
    [orderGroupItems, imageRequestsByItemId],
  );

  const groupPhotoSections = useMemo(() => {
    return itemsWithOpenRequest.map((item) => {
      const request = imageRequestsByItemId.get(item.id);
      return {
        item,
        request,
        images: request?.images ?? [],
      };
    });
  }, [itemsWithOpenRequest, imageRequestsByItemId]);

  const allGroupImages = useMemo(
    () =>
      groupPhotoSections.flatMap((section) =>
        section.images.map((img) => ({
          ...img,
          listingTitle: section.item.listingTitle,
          orderItemId: section.item.id,
        })),
      ),
    [groupPhotoSections],
  );

  const showPhotosCard =
    photoEligibleItems.length > 0 ||
    itemsWithOpenRequest.length > 0 ||
    orderGroupItems.some((item) => isAwaitingVendorForPhotos(item.status));

  const groupKey = groupItemIds.slice().sort().join("|");

  useEffect(() => {
    setPhotoSelectionInitialized(false);
    setPhotoRequestSelection([]);
  }, [groupKey]);

  useEffect(() => {
    // Wait until open-request status is known — otherwise null (still loading) looks "eligible"
    // and Request selected can show (2) while the list only has 1 item (e.g. one already requested).
    if (!imageRequestsReady) return;

    const eligibleIds = photoEligibleItems.map((item) => item.id);
    const eligibleSet = new Set(eligibleIds);

    if (!photoSelectionInitialized) {
      setPhotoRequestSelection(eligibleIds);
      setPhotoSelectionInitialized(true);
      return;
    }

    setPhotoRequestSelection((prev) => {
      const next = prev.filter((id) => eligibleSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [imageRequestsReady, photoEligibleItems, photoSelectionInitialized]);

  const createImageRequestMut = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const results = await Promise.allSettled(
        itemIds.map((id) => customerApi.createOrderImageRequest(id)),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      return { succeeded, failed, total: results.length };
    },
    onSuccess: ({ succeeded, failed, total }) => {
      if (succeeded > 0) {
        toast.success(
          total === 1
            ? "Photo request sent to the supplier."
            : `Photo request sent to suppliers for ${succeeded} product${succeeded === 1 ? "" : "s"}.`,
        );
      }
      if (failed > 0) {
        toast.error(
          failed === total
            ? "Failed to send photo request(s)."
            : `${failed} item${failed === 1 ? "" : "s"} could not be requested.`,
        );
      }
      for (const id of groupItemIds) {
        queryClient.invalidateQueries({ queryKey: ["customer-order-image-request", id] });
      }
      setPhotoSelectionInitialized(false);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to request photos."),
  });

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
    return <PageLoaderSlot />;
  }

  const activeItem = data;

  return (
    <div className="mx-auto max-w-3xl space-y-2.5 sm:space-y-4">
      <BackLink to="/customer/orders" label="Back to orders" />

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order group</p>
              <h1 className="mt-0.5 break-all text-[15px] font-semibold tracking-tight tabular-nums sm:text-xl sm:font-bold">
                {baseOrderNumber}
              </h1>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-2xl sm:font-bold">
                ₹{groupTotalAmount.toFixed(0)}
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                + ₹{groupDepositAmount.toFixed(0)} deposit
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            <p className="text-[13px] font-semibold sm:text-base">Items in this order</p>
            {orderGroupItems.map((item) => {
              const isSelected = item.id === activeItem.id;
              const imageUrl = resolveItemImageUrl(item);
              const openRequest = imageRequestsByItemId.get(item.id);
              const photoCount = openRequest?.images?.length ?? 0;
              const photoLabel = openRequest
                ? photoCount === 0
                  ? "Photos requested · waiting"
                  : `${photoCount} photo${photoCount === 1 ? "" : "s"} received`
                : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={cn(
                    "flex w-full gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                    isSelected
                      ? "border-foreground/50 bg-accent/40 shadow-sm"
                      : "border-border/70 bg-background hover:bg-accent/20",
                  )}
                >
                  <OrderItemThumb src={imageUrl} alt={item.listingTitle} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold leading-snug">{item.listingTitle}</p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">₹{item.totalAmount.toFixed(0)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Qty {item.quantity}</span>
                      <span
                        title={customerFacingStatus(item.status)}
                        className={cn(
                          "inline-flex items-center rounded-full",
                          orderStatusBadgeSizeClass,
                          orderStatusBadgeClass(item.status),
                        )}
                      >
                        {formatOrderStatusLabel(item.status)}
                      </span>
                      {photoLabel ? (
                        <span className="text-[11px] text-muted-foreground">· {photoLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-3 pb-2 sm:p-4 sm:pb-2">
          <p className="min-w-0 truncate text-[13px] font-semibold sm:text-base">
            Timeline
            <span className="ml-1.5 font-normal text-muted-foreground">· {activeItem.listingTitle}</span>
          </p>
          <Button variant="link" className="h-auto shrink-0 p-0 text-xs font-semibold text-primary" asChild>
            <Link to={`/customer/shop/${encodeURIComponent(activeItem.listingId)}`}>
              View listing
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
          <OrderTimeline status={activeItem.status} orderType={activeItem.orderType} />
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
          <p className="text-[13px] font-semibold sm:text-base">
            {activeItem.orderType?.toLowerCase() === "buy" ? "Purchase details" : "Rental details"}
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border/60 px-3 pb-2 sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-4 sm:divide-y-0 sm:px-4 sm:pb-4">
          {activeItem.orderType?.toLowerCase() === "buy" ? (
            <>
              <DetailRow label="Purchase date">{formatDetailDate(activeItem.startDate)}</DetailRow>
              <DetailRow label="Quantity">{activeItem.quantity}</DetailRow>
            </>
          ) : (
            <>
              <DetailRow label="Start date">{formatDetailDate(activeItem.startDate)}</DetailRow>
              <DetailRow label="End date">{formatDetailDate(activeItem.endDate)}</DetailRow>
              <DetailRow label="Quantity">{activeItem.quantity}</DetailRow>
              <DetailRow label="Order type">
                <span className="uppercase">{activeItem.orderType}</span>
              </DetailRow>
              <DetailRow label="Rental period" rowStart>
                {compactDurationLabel(activeItem.rentalDurationLabel) || (
                  <>
                    {activeItem.rentalDays}{" "}
                    {activeItem.rentalPeriodUnit === "week"
                      ? activeItem.rentalDays === 1
                        ? "week"
                        : "weeks"
                      : activeItem.rentalPeriodUnit === "month"
                        ? activeItem.rentalDays === 1
                          ? "month"
                          : "months"
                        : activeItem.rentalDays === 1
                          ? "day"
                          : "days"}
                  </>
                )}
              </DetailRow>
              <DetailRow label="Duration" rowStart>
                {activeItem.rentalDurationDays
                  ? `${activeItem.rentalDurationDays} day${activeItem.rentalDurationDays === 1 ? "" : "s"}`
                  : "—"}
              </DetailRow>
              <DetailRow label="Plan price" span={2} rowStart>
                {activeItem.rentalFinalPrice != null ? (
                  <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 sm:justify-start">
                    {activeItem.rentalNormalPrice != null &&
                    Number(activeItem.rentalNormalPrice) > Number(activeItem.rentalFinalPrice) ? (
                      <span className="strike-diagonal w-fit text-xs font-semibold tabular-nums text-rose-500 dark:text-rose-400">
                        ₹{Number(activeItem.rentalNormalPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    ) : null}
                    <span className="tabular-nums">
                      ₹{Number(activeItem.rentalFinalPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ) : (
                  "—"
                )}
              </DetailRow>
            </>
          )}
        </CardContent>
      </Card>

      {/* Medical Reference */}
      {(activeItem.doctorId ||
        activeItem.hospitalId ||
        activeItem.doctorName ||
        activeItem.doctorUniqueCode) && (
        <OrderMedicalReferenceCard
          doctorName={activeItem.doctorName}
          doctorSpecialization={activeItem.doctorSpecialization}
          doctorUniqueCode={activeItem.doctorUniqueCode}
          doctorContactNumber={activeItem.doctorContactNumber}
          hospitalName={activeItem.hospitalName}
          hospitalCity={activeItem.hospitalCity}
        />
      )}

      {/* Request vendor photos — order-group aware (all items / selected items) */}
      {showPhotosCard && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-3 pb-2 sm:p-4 sm:pb-2">
            <p className="text-[13px] font-semibold sm:text-base">Request photos from your supplier</p>
            <p className="text-xs text-muted-foreground">
              {orderGroupItems.length > 1
                ? `Photos come from each product’s supplier. Up to ${MAX_ORDER_IMAGES} per item.`
                : `Photos come from this product’s supplier. Up to ${MAX_ORDER_IMAGES} photos.`}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {!imageRequestsReady || imageRequestLoading ? (
              <p className="text-sm text-muted-foreground">Loading photo requests…</p>
            ) : (
              <>
                {photoEligibleItems.length > 0 && (
                  <div className="space-y-3">
                    {orderGroupItems.length > 1 && (
                      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Select products
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                setPhotoRequestSelection(photoEligibleItems.map((item) => item.id))
                              }
                            >
                              Select all
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setPhotoRequestSelection([])}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {photoEligibleItems.map((item) => {
                            const checked = photoRequestSelection.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-1 py-1.5 hover:bg-background/80"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    setPhotoRequestSelection((prev) => {
                                      if (value === true) {
                                        return prev.includes(item.id) ? prev : [...prev, item.id];
                                      }
                                      return prev.filter((id) => id !== item.id);
                                    });
                                  }}
                                />
                                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                  {item.listingTitle}
                                </span>
                                <span className="text-[11px] capitalize text-muted-foreground">
                                  {customerFacingStatus(item.status)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                      {orderGroupItems.length > 1 && (
                        <Button
                          type="button"
                          variant="default"
                          className="h-12 w-full justify-center sm:h-10 sm:w-auto"
                          disabled={createImageRequestMut.isPending || photoEligibleItems.length === 0}
                          onClick={() =>
                            createImageRequestMut.mutate(photoEligibleItems.map((item) => item.id))
                          }
                        >
                          {createImageRequestMut.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                          ) : (
                            <Images className="mr-2 h-4 w-4 shrink-0" />
                          )}
                          Request all ({photoEligibleItems.length})
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-full justify-center sm:h-10 sm:w-auto"
                        disabled={
                          createImageRequestMut.isPending ||
                          (orderGroupItems.length > 1
                            ? photoRequestSelection.length === 0
                            : photoEligibleItems.length === 0)
                        }
                        onClick={() => {
                          const ids =
                            orderGroupItems.length > 1
                              ? photoRequestSelection
                              : photoEligibleItems.map((item) => item.id);
                          createImageRequestMut.mutate(ids);
                        }}
                      >
                        {createImageRequestMut.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                        ) : orderGroupItems.length > 1 ? (
                          <CheckSquare className="mr-2 h-4 w-4 shrink-0" />
                        ) : (
                          <Images className="mr-2 h-4 w-4 shrink-0" />
                        )}
                        {orderGroupItems.length > 1
                          ? `Request selected (${photoRequestSelection.length})`
                          : "Request photos from supplier"}
                      </Button>
                    </div>
                  </div>
                )}

                {photoEligibleItems.length === 0 &&
                  itemsWithOpenRequest.length === 0 &&
                  orderGroupItems.some((item) => isAwaitingVendorForPhotos(item.status)) && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        You can request supplier photos after a supplier accepts each product.
                      </p>
                      <Button type="button" variant="outline" disabled>
                        <Images className="mr-2 h-4 w-4" />
                        Waiting for supplier acceptance
                      </Button>
                    </div>
                  )}

                {itemsWithOpenRequest.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Photo request status by product
                      </p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {allGroupImages.length} photo{allGroupImages.length === 1 ? "" : "s"} received
                        {itemsWithOpenRequest.length > 1
                          ? ` · ${itemsWithOpenRequest.length} products requested`
                          : ""}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {groupPhotoSections.map(({ item, images }) => {
                        const waiting = images.length === 0;
                        const isActiveItem = item.id === activeItem.id;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "rounded-lg border p-3 space-y-2",
                              waiting
                                ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
                                : "border-border/70 bg-muted/20",
                              isActiveItem && "ring-1 ring-primary/30",
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {item.listingTitle}
                                </p>
                                <p className="text-[11px] capitalize text-muted-foreground mt-0.5">
                                  {customerFacingStatus(item.status)}
                                  {isActiveItem ? " · currently viewing" : ""}
                                </p>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  waiting
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                                )}
                              >
                                <Images className="h-3 w-3" />
                                {waiting
                                  ? "Waiting for supplier photos"
                                  : `${images.length}/${MAX_ORDER_IMAGES} received`}
                              </span>
                            </div>
                            {waiting ? (
                              <p className="text-xs text-muted-foreground">
                                Request already sent for this product — supplier has not uploaded photos yet.
                              </p>
                            ) : (
                              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                                {images.map((img: CustomerOrderImageApi) => (
                                  <button
                                    key={img.id}
                                    type="button"
                                    className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                                    onClick={() => setPreviewImageUrl(img.fileUrl)}
                                    aria-label={`Preview photo for ${item.listingTitle}`}
                                  >
                                    <img
                                      src={img.fileUrl}
                                      alt={img.originalFileName || item.listingTitle}
                                      className="h-full w-full object-cover"
                                      onError={retryOriginalOnImageError}
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader className="border-b border-border px-4 py-3 pr-12">
            <DialogTitle className="text-sm font-semibold">Photo preview</DialogTitle>
          </DialogHeader>
          {previewImageUrl ? (
            <ZoomableImageStage
              src={originalUrlFromThumb(previewImageUrl) ?? previewImageUrl}
              alt="Order photo preview"
              resetKey={previewImageUrl}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Support and Cancellation Actions for Selected Item */}
      <div className="grid grid-cols-2 gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex sm:flex-wrap sm:gap-3">
        <Button variant="outline" className="w-full justify-center sm:w-auto" asChild>
          <Link
            className="inline-flex items-center justify-center"
            to={`/customer/support?order=${encodeURIComponent(activeItem.orderNumber)}`}
          >
            <Headset className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
            <span className="sm:hidden">Support</span>
            <span className="hidden sm:inline">BlinksMed support</span>
          </Link>
        </Button>

        <Button variant="outline" className="w-full justify-center sm:w-auto" onClick={() => setIsChatOpen(true)}>
          <MessageCircle className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
          <span className="sm:hidden">Chat</span>
          <span className="hidden sm:inline">Chat with BlinksMed</span>
        </Button>

        {isCustomerOrderCancellable(activeItem.status) && (
          <Button
            variant="destructive"
            className="col-span-2 w-full sm:col-auto sm:w-auto"
            disabled={cancelMut.isPending}
            onClick={() => cancelMut.mutate(activeItem.id)}
          >
            Cancel item request
          </Button>
        )}

        {activeItem.status.trim().toLowerCase() === "active" && activeItem.orderType.toLowerCase() === "rent" && (
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
            <Button
              variant="default"
              className="w-full sm:w-auto"
              onClick={() => {
                setExtensionDays(1);
                setExtensionQuote(null);
                setExtensionDialogOpen(true);
                quoteExtensionMut.mutate(1);
              }}
            >
              Extend Rental
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setBuyoutQuote(null);
                setBuyoutDialogOpen(true);
                quoteBuyoutMut.mutate();
              }}
            >
              Buyout Item
            </Button>
          </div>
        )}
      </div>

      <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Rental</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Additional Days</Label>
              <div className="flex items-center gap-4">
                <Input 
                  type="number" 
                  min={1} 
                  max={365} 
                  value={extensionDays} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setExtensionDays(val);
                    quoteExtensionMut.mutate(val);
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            {quoteExtensionMut.isPending ? (
              <p className="text-sm text-muted-foreground">Calculating quote…</p>
            ) : extensionQuote ? (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>New End Date:</span>
                  <span className="font-semibold">{formatDetailDate(extensionQuote.newEndDate)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Extension Rent:</span>
                  <span>₹{extensionQuote.extensionAmount.toFixed(2)}</span>
                </div>
                {/* Service fee UI hidden — keep for future re-enable */}
                {false && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Fee:</span>
                    <span>₹{extensionQuote.serviceFeeAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>GST:</span>
                  <span>₹{extensionQuote.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold text-foreground">
                  <span>Total Amount:</span>
                  <span>₹{extensionQuote.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtensionDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => processExtensionMut.mutate()} 
              disabled={processExtensionMut.isPending || quoteExtensionMut.isPending || !extensionQuote}
            >
              {processExtensionMut.isPending ? "Processing..." : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={buyoutDialogOpen} onOpenChange={setBuyoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buyout Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Love this item? You can purchase it permanently. We'll deduct a portion of the rent you've already paid from the final price.
            </p>

            {quoteBuyoutMut.isPending ? (
              <p className="text-sm text-muted-foreground">Calculating quote…</p>
            ) : buyoutQuote ? (
              <div className="rounded-lg border bg-emerald-50/50 p-4 space-y-2 text-sm dark:bg-emerald-950/20">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Buyout Price:</span>
                  <span>₹{buyoutQuote.baseBuyoutAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Rent Deduction (50% of paid):</span>
                  <span>-₹{buyoutQuote.rentDeductionAmount.toFixed(2)}</span>
                </div>
                {/* Service fee UI hidden — keep for future re-enable */}
                {false && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service Fee:</span>
                    <span>₹{buyoutQuote.serviceFeeAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>GST:</span>
                  <span>₹{buyoutQuote.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2 font-bold text-foreground dark:border-emerald-800">
                  <span>Final Price:</span>
                  <span>₹{buyoutQuote.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyoutDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => processBuyoutMut.mutate()} 
              disabled={processBuyoutMut.isPending || quoteBuyoutMut.isPending || !buyoutQuote}
            >
              {processBuyoutMut.isPending ? "Processing..." : "Confirm & Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent className="flex h-full w-full max-w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b p-4 pr-12 text-left sm:p-6">
            <SheetTitle>Chat with BlinksMed support</SheetTitle>
            <SheetDescription asChild>
              <div className="space-y-1 text-xs leading-snug">
                <p className="text-muted-foreground">
                  Message support about this order.
                </p>
                <p className="font-medium text-violet-600 dark:text-violet-400">
                  Order: {activeItem.orderNumber} • {activeItem.listingTitle}
                </p>
              </div>
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {!activeSession ? (
              <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
                <MessageCircle className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">No active conversation</p>
                  <p className="text-xs text-muted-foreground">
                    Start a chat with support about this order.
                  </p>
                </div>
                <Button
                  onClick={() => createSessionMut.mutate()}
                  disabled={createSessionMut.isPending}
                >
                  {createSessionMut.isPending ? "Starting chat..." : "Start Chat"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col space-y-6">
                {messages && messages.length > 0 ? (
                  messages.map((msg, index) => {
                    const isMe = msg.senderType === "Customer";
                    const prev = index > 0 ? messages[index - 1] : null;
                    const showDay = !prev || !isSameChatDay(prev.sentAt, msg.sentAt);
                    return (
                      <div key={msg.id} className="flex flex-col gap-2">
                        {showDay && <ChatDaySeparator date={msg.sentAt} />}
                        <div
                          className={cn(
                            "flex max-w-[88%] flex-col sm:max-w-[75%]",
                            isMe ? "ml-auto items-end" : "mr-auto items-start",
                          )}
                        >
                          <div className="mb-1 flex items-center gap-2 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {isMe ? "You" : msg.senderType === "Admin" ? "Support Team" : msg.senderType}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">
                              {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "whitespace-pre-wrap rounded-2xl px-5 py-3 text-[14px] leading-relaxed shadow-sm",
                              isMe
                                ? "rounded-tr-none bg-primary text-primary-foreground shadow-primary/10"
                                : "rounded-tl-none border bg-card text-foreground",
                            )}
                          >
                            {msg.messageText}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-12 text-center text-xs text-muted-foreground">
                    Send a message to start the conversation.
                  </p>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {activeSession && (
            <div className="shrink-0 border-t bg-background p-3 sm:p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMessageText.trim()) return;
                  sendMessageMut.mutate(newMessageText.trim());
                }}
                className="flex items-end gap-2"
              >
                <ChatMessageTextarea
                  placeholder="Type a message..."
                  value={newMessageText}
                  onChange={setNewMessageText}
                  onSubmit={() => {
                    if (!newMessageText.trim() || sendMessageMut.isPending) return;
                    sendMessageMut.mutate(newMessageText.trim());
                  }}
                  submitDisabled={sendMessageMut.isPending}
                  disabled={sendMessageMut.isPending}
                  className="min-w-0 flex-1"
                />
                <Button type="submit" size="sm" className="shrink-0" disabled={sendMessageMut.isPending || !newMessageText.trim()}>
                  Send
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CustomerOrderDetail;

