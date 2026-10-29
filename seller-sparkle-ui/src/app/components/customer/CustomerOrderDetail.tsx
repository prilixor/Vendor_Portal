import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckSquare, Headset, ImageOff, Images, Info, Loader2, Maximize2, MessageCircle, Package } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import {
  customerApi,
  type CustomerExtensionApi,
  type CustomerOrderImageApi,
  type CustomerOrderImageRequestApi,
} from "@/app/services/customerApi";
import { openRazorpayCheckout } from "@/app/helpers/razorpayCheckout";
import { customerRefundChip, formatInr } from "@/app/helpers/orderReturn";
import { combinedRefundSummary, customerCancellationChip } from "@/app/helpers/orderCancellation";
import { chatApi } from "@/app/services/chatApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import { OrderPrescriptionFilesCard } from "@/app/components/shared/OrderPrescriptionFilesCard";
import { LegalAgreeCheckbox } from "@/app/components/legal/LegalAgreeCheckbox";
import { BackLink } from "@/app/components/shared/BackLink";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ZoomableImageStage } from "@/app/components/shared/ZoomableImageStage";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/app/components/ui/sheet";
import { Input } from "@/app/components/ui/input";
import { ChatMessageTextarea } from "@/app/components/shared/ChatMessageTextarea";
import { ChatDaySeparator } from "@/app/components/shared/ChatDaySeparator";
import { toast } from "sonner";
import { isSameChatDay } from "@/app/helpers/chatDayLabel";
import { formatGstRateLabel } from "@/app/helpers/gstLabel";
import { formatCustomerOrderStatusTitle, formatCustomerOrderStatusLabel, formatOrderTypeLabel, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, orderPhotoTileUrl, originalUrlFromThumb, photoAtSlot, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import type { ExtensionQuoteApi, BuyoutQuoteApi } from "@/app/services/customerApi";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Label } from "@/app/components/ui/label";
import { LegalPolicyLinks } from "@/app/components/legal/LegalPolicyLinks";
import { CancelOrderConfirm } from "@/app/components/legal/CancelOrderConfirm";

/** Hide Buyout Item on the customer order page. Extend Rental stays. */
const SHOW_CUSTOMER_BUYOUT = false;

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

/** Match Customer Mobile order detail polling while the page is open. */
const CUSTOMER_ORDER_POLL_MS = 5_000;

function isOrderGuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function orderStatusCompact(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Photo request is only meaningful once a fulfilling vendor is assigned. */
function canRequestOrderImages(status: string): boolean {
  const compact = orderStatusCompact(status);
  return compact === "pending" || compact === "confirmed" || compact === "in_transit";
}

function canUploadPrescription(status: string): boolean {
  const compact = orderStatusCompact(status);
  return !["cancelled", "canceled", "dispatch_failed", "active", "completed", "returned"].includes(compact);
}

function isAwaitingVendorForPhotos(status: string): boolean {
  const compact = orderStatusCompact(status);
  return (
    compact === "awaiting_vendor_acceptance" ||
    compact === "pending_vendor_acceptance"
  );
}

function OrderOptionPhotoThumb({
  src,
  alt,
  onPreview,
}: {
  src: string;
  alt: string;
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative aspect-square w-full overflow-hidden rounded-xl bg-muted ring-1 ring-inset ring-black/[0.06] transition-transform hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:ring-white/10"
      onClick={onPreview}
      aria-label={alt}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        onError={retryOriginalOnImageError}
      />
    </button>
  );
}

function OrderOptionEmptySlot() {
  return (
    <div
      className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl bg-muted/55 px-1 ring-1 ring-inset ring-border/70 dark:bg-muted/25"
      aria-label="No image"
    >
      <ImageOff className="h-5 w-5 text-muted-foreground/55" />
      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        Empty
      </span>
    </div>
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
  dispatchFailed: boolean;
  completedThrough: number;
  currentIndex: number | null;
} {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";
  const open = { cancelled: false, dispatchFailed: false };

  if (compact === "cancelled" || compact === "canceled") {
    return { cancelled: true, dispatchFailed: false, completedThrough: -1, currentIndex: null };
  }
  if (compact === "dispatch_failed" || raw.includes("dispatch failed")) {
    return { cancelled: false, dispatchFailed: true, completedThrough: -1, currentIndex: null };
  }
  if (compact === "pending") {
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
      ? { ...open, completedThrough: 3, currentIndex: null }
      : { ...open, completedThrough: 3, currentIndex: 4 };
  }
  if (compact === "returned") {
    return { ...open, completedThrough: 5, currentIndex: null };
  }
  return { ...open, completedThrough: 0, currentIndex: 1 };
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
  const { cancelled, dispatchFailed, completedThrough, currentIndex } = getTimelineProgress(status, orderType);

  if (dispatchFailed) {
    return <p className="text-sm text-muted-foreground">No vendor accepted this product.</p>;
  }

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeIsGuid = isOrderGuid(orderId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [extensionDays, setExtensionDays] = useState(1);
  const [extensionQuote, setExtensionQuote] = useState<ExtensionQuoteApi | null>(null);

  const [buyoutDialogOpen, setBuyoutDialogOpen] = useState(false);
  const [buyoutQuote, setBuyoutQuote] = useState<BuyoutQuoteApi | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [optionNotePreview, setOptionNotePreview] = useState<{ label: string; description: string } | null>(null);
  const [openOptionInfoId, setOpenOptionInfoId] = useState<string | null>(null);
  const [photoRequestSelection, setPhotoRequestSelection] = useState<string[]>([]);
  const [photoSelectionInitialized, setPhotoSelectionInitialized] = useState(false);

  // Support links historically used the order number. Resolve it to the order id before calling the API.
  const orderNumberLookup = useQuery({
    queryKey: ["customer-order-id-by-number", orderId],
    enabled: !!orderId && !routeIsGuid,
    retry: false,
    queryFn: async () => {
      const result = await customerApi.getOrderSummaries({ search: orderId, pageSize: 50 });
      const wanted = orderId!.trim().toLowerCase();
      return result.items.find((item) => item.orderNumber.trim().toLowerCase() === wanted)?.id ?? null;
    },
  });

  useEffect(() => {
    if (!orderNumberLookup.data || !isOrderGuid(orderNumberLookup.data)) return;
    navigate(`/customer/orders/${orderNumberLookup.data}`, { replace: true });
  }, [navigate, orderNumberLookup.data]);

  // Fetch current selected item details
  const currentItemId = selectedItemId || (routeIsGuid ? orderId : undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-order", currentItemId],
    queryFn: () => customerApi.getOrder(currentItemId!),
    enabled: !!currentItemId,
    refetchInterval: CUSTOMER_ORDER_POLL_MS,
  });

  const { data: groupOrders } = useQuery({
    queryKey: ["customer-order-group", orderId],
    queryFn: () => customerApi.getOrderGroup(orderId!, { quiet: true }),
    enabled: routeIsGuid && !!orderId,
    refetchInterval: CUSTOMER_ORDER_POLL_MS,
  });

  const { data: prescriptionFiles = [] } = useQuery({
    queryKey: ["customer-order-prescriptions", currentItemId],
    queryFn: () => customerApi.getOrderPrescriptions(currentItemId!),
    enabled: !!currentItemId,
  });

  const [acceptedRxLegal, setAcceptedRxLegal] = useState(false);

  useEffect(() => {
    setAcceptedRxLegal(false);
  }, [currentItemId]);

  const uploadRxMut = useMutation({
    mutationFn: (file: File) =>
      customerApi.uploadOrderPrescription(currentItemId!, file, {
        acceptedPrescriptionLegal: true,
        uploadSource: "order_detail",
      }),
    onSuccess: () => {
      setAcceptedRxLegal(false);
      toast.success("Prescription uploaded.");
      queryClient.invalidateQueries({ queryKey: ["customer-order-prescriptions", currentItemId] });
      queryClient.invalidateQueries({ queryKey: ["customer-order", currentItemId] });
    },
    onError: (err: Error) => toast.error(err.message || "Unable to upload prescription."),
  });

  const deleteRxMut = useMutation({
    mutationFn: (fileId: string) => customerApi.deleteOrderPrescription(currentItemId!, fileId),
    onSuccess: () => {
      toast.success("Prescription removed.");
      queryClient.invalidateQueries({ queryKey: ["customer-order-prescriptions", currentItemId] });
      queryClient.invalidateQueries({ queryKey: ["customer-order", currentItemId] });
    },
    onError: (err: Error) => toast.error(err.message || "Unable to remove prescription."),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => customerApi.cancelOrder(id),
    onSuccess: (_, variables) => {
      toast.success("Order cancelled.");
      queryClient.invalidateQueries({ queryKey: ["customer-order", variables] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-group"] });
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
      const updatedExisting = (extensionQuote?.pendingDays ?? 0) > 0;
      toast.success(updatedExisting
        ? "Extension request updated. Still waiting for vendor approval."
        : "Rental extension requested successfully! Pending approval.");
      setExtensionDialogOpen(false);
      setExtensionQuote(null);
      queryClient.invalidateQueries({ queryKey: ["customer-order", activeItem?.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-extensions"] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-group"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to process extension.")
  });

  const payExtensionMut = useMutation({
    mutationFn: async (ext: CustomerExtensionApi) => {
      const order = data;
      if (!order) throw new Error("Order not loaded.");
      const session = await customerApi.startExtensionPayment(order.id, ext.extensionId);
      if (!session.razorpayOrderId) throw new Error("Payment could not be started. Please try again.");
      const payment = await openRazorpayCheckout({
        key: session.razorpayKeyId,
        amountPaise: Math.round(Number(session.amount) * 100),
        currency: session.currency || "INR",
        orderId: session.razorpayOrderId,
        description: `Extension for ${order.listingTitle}`,
      });
      await customerApi.verifyExtensionPayment(order.id, ext.extensionId, {
        checkoutSessionId: session.checkoutSessionId,
        razorpayOrderId: payment.razorpay_order_id,
        razorpayPaymentId: payment.razorpay_payment_id,
        razorpaySignature: payment.razorpay_signature,
      });
    },
    onSuccess: () => {
      toast.success("Extension paid. The new end date is now on this product.");
      queryClient.invalidateQueries({ queryKey: ["customer-order", currentItemId] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-extensions"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-group"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-summaries"] });
    },
    onError: (err: Error) => toast.error(err.message || "Extension payment failed."),
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
      queryClient.invalidateQueries({ queryKey: ["customer-order-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-group"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to process buyout.")
  });

  const orderGroupItems = useMemo(() => {
    if (groupOrders && groupOrders.length > 0) return groupOrders;
    return data ? [data] : [];
  }, [data, groupOrders]);

  const groupItemIds = useMemo(() => orderGroupItems.map((item) => item.id), [orderGroupItems]);

  const extensionQueries = useQueries({
    queries: groupItemIds.map((itemId) => ({
      queryKey: ["customer-order-extensions", itemId],
      queryFn: () => customerApi.getOrderExtensions(itemId),
      enabled: groupItemIds.length > 0,
      refetchInterval: CUSTOMER_ORDER_POLL_MS,
    })),
  });

  const extensionsByItemId = useMemo(() => {
    const map = new Map<string, CustomerExtensionApi[]>();
    groupItemIds.forEach((itemId, index) => {
      map.set(itemId, extensionQueries[index]?.data ?? []);
    });
    return map;
  }, [groupItemIds, extensionQueries]);

  const imageRequestQueries = useQueries({
    queries: groupItemIds.map((itemId) => ({
      queryKey: ["customer-order-image-request", itemId],
      queryFn: () => customerApi.getOrderImageRequest(itemId),
      enabled: groupItemIds.length > 0,
      refetchInterval: CUSTOMER_ORDER_POLL_MS,
    })),
  });

  const imageRequestLoading = imageRequestQueries.some((q) => q.isLoading);
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

  const selectImageOptionMut = useMutation({
    mutationFn: ({ orderId: itemOrderId, optionId }: { orderId: string; optionId: string }) =>
      customerApi.selectOrderImageOption(itemOrderId, optionId),
    onSuccess: (_row, vars) => {
      toast.success("Option selected.");
      queryClient.invalidateQueries({ queryKey: ["customer-order-image-request", vars.orderId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to select option."),
  });

  // Combined totals for the order group
  const groupTotalAmount = useMemo(() => {
    return orderGroupItems.reduce((sum, item) => sum + (item?.totalAmount ?? 0), 0);
  }, [orderGroupItems]);

  const groupDepositAmount = useMemo(() => {
    return orderGroupItems.reduce((sum, item) => sum + (item?.depositAmount ?? 0), 0);
  }, [orderGroupItems]);

  const refundSummary = useMemo(
    () => combinedRefundSummary(
      orderGroupItems.map((item) => item.returnSettlement),
      orderGroupItems.map((item) => item.cancellationRefund),
    ),
    [orderGroupItems],
  );

  const baseOrderNumber = useMemo(() => {
    if (!data || !data.orderNumber) return "";
    return data.orderNumber.split('-').slice(0, 3).join('-');
  }, [data]);

  if (!orderId) return <p className="text-sm text-muted-foreground">Missing order.</p>;

  if (!routeIsGuid) {
    if (orderNumberLookup.isError) {
      const lookupError = orderNumberLookup.error;
      return (
        <div className="space-y-4">
          <p className="text-sm text-destructive">
            {lookupError instanceof Error ? lookupError.message : "Not found."}
          </p>
          <Button variant="outline" asChild>
            <Link to="/customer/orders">Back to orders</Link>
          </Button>
        </div>
      );
    }
    if (orderNumberLookup.isSuccess && !orderNumberLookup.data) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-destructive">Order not found.</p>
          <Button variant="outline" asChild>
            <Link to="/customer/orders">Back to orders</Link>
          </Button>
        </div>
      );
    }
    return <PageLoaderSlot />;
  }

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

  if ((isLoading && !data) || !data) {
    return <PageLoaderSlot />;
  }

  const activeItem = data;
  const activeReturn = activeItem.returnSettlement
    ?? orderGroupItems.find((item) => item.id === activeItem.id)?.returnSettlement
    ?? null;
  const activeCancellation = activeItem.cancellationRefund
    ?? orderGroupItems.find((item) => item.id === activeItem.id)?.cancellationRefund
    ?? null;
  const activeExtensions = extensionsByItemId.get(activeItem.id) ?? [];
  const paidExtensions = activeExtensions.filter((ext) => ext.status === "paid");
  const awaitingExtension = activeExtensions.find((ext) => ext.status === "awaiting_payment") ?? null;
  const pendingExtension = activeExtensions.find((ext) => ext.status === "pending_approval") ?? null;
  const paidExtensionTotal = paidExtensions.reduce((sum, ext) => sum + (ext.totalAmount ?? 0), 0);
  const originalRentalAmount = Math.max(0, (activeItem.totalAmount ?? 0) - paidExtensionTotal);
  const shownPrescriptionFiles = activeItem.prescriptionFiles?.length
    ? activeItem.prescriptionFiles
    : prescriptionFiles;
  const canAddPrescription =
    canUploadPrescription(activeItem.status) && shownPrescriptionFiles.length < 3;

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
              {refundSummary ? (
                <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {refundSummary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            <p className="text-[13px] font-semibold sm:text-base">Items in this order</p>
            {orderGroupItems.map((item) => {
              const isSelected = item.id === activeItem.id;
              const itemExtensions = extensionsByItemId.get(item.id) ?? [];
              const itemExtended = itemExtensions.some((ext) => ext.status === "paid");
              const itemPaymentDue = itemExtensions.some((ext) => ext.status === "awaiting_payment");
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
                        {formatCustomerOrderStatusLabel(item.status)}
                      </span>
                      {itemExtended ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          EXTENDED
                        </span>
                      ) : null}
                      {itemPaymentDue ? (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-900 dark:bg-orange-950/40 dark:text-orange-200">
                          Payment due
                        </span>
                      ) : null}
                      {customerRefundChip(item.returnSettlement) ? (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                          {customerRefundChip(item.returnSettlement)}
                        </span>
                      ) : null}
                      {customerCancellationChip(item.cancellationRefund) ? (
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
                          {customerCancellationChip(item.cancellationRefund)}
                        </span>
                      ) : null}
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

      {activeReturn ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
            <p className="text-[13px] font-semibold sm:text-base">
              Deposit refund
              <span className="ml-1.5 font-normal text-muted-foreground">· {activeItem.listingTitle}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3 text-sm sm:px-4 sm:pb-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Deposit</p>
                <p className="font-medium tabular-nums">₹{formatInr(activeReturn.depositAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Damage charge</p>
                <p className="font-medium tabular-nums">₹{formatInr(activeReturn.damageAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Refund</p>
                <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  ₹{formatInr(activeReturn.refundAmount)}
                  {activeReturn.refundAmount > 0
                    ? activeReturn.status === "refunded"
                      ? " received"
                      : " processing"
                    : ""}
                </p>
              </div>
            </div>
            {activeReturn.damageReason ? <p className="text-muted-foreground">{activeReturn.damageReason}</p> : null}
            {activeReturn.status === "refunded" && activeReturn.refundedAt ? (
              <p className="text-xs text-muted-foreground">
                Received {new Date(activeReturn.refundedAt).toLocaleString()}
              </p>
            ) : activeReturn.refundAmount <= 0 ? (
              <p className="text-xs text-muted-foreground">
                {activeReturn.damageAmount > 0
                  ? "The damage charge uses this product's full deposit, so nothing is refunded."
                  : "No security deposit is due back on this product."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">BlinksMed is sending this refund to your original payment.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeCancellation ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
            <p className="text-[13px] font-semibold sm:text-base">
              Cancellation refund
              <span className="ml-1.5 font-normal text-muted-foreground">· {activeItem.listingTitle}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pb-3 text-sm sm:px-4 sm:pb-4">
            <p className="text-muted-foreground">{activeCancellation.actorLabel}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Paid</p>
                <p className="font-medium tabular-nums">₹{formatInr(activeCancellation.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Charge</p>
                <p className="font-medium tabular-nums">₹{formatInr(activeCancellation.chargeAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Refund</p>
                <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  ₹{formatInr(activeCancellation.refundAmount)}
                  {activeCancellation.refundAmount > 0
                    ? activeCancellation.status === "refunded"
                      ? " received"
                      : " processing"
                    : ""}
                </p>
              </div>
            </div>
            {activeCancellation.chargeReason ? <p className="text-muted-foreground">{activeCancellation.chargeReason}</p> : null}
            {activeCancellation.status === "refunded" && activeCancellation.refundedAt ? (
              <p className="text-xs text-muted-foreground">
                Received {new Date(activeCancellation.refundedAt).toLocaleString()}
              </p>
            ) : activeCancellation.status === "pending_review" ? (
              <p className="text-xs text-muted-foreground">BlinksMed is reviewing this payment before anything is sent back.</p>
            ) : activeCancellation.refundAmount <= 0 ? (
              <p className="text-xs text-muted-foreground">The charge uses the full payment for this product, so nothing is refunded.</p>
            ) : (
              <p className="text-xs text-muted-foreground">BlinksMed is sending this refund to your original payment.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

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
              <DetailRow label="End date">
                <span className="inline-flex flex-wrap items-center justify-end gap-2 sm:justify-start">
                  {formatDetailDate(activeItem.endDate)}
                  {(extensionsByItemId.get(activeItem.id) ?? []).some((ext) => ext.status === "paid") ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      EXTENDED
                    </span>
                  ) : null}
                </span>
              </DetailRow>
              <DetailRow label="Quantity">{activeItem.quantity}</DetailRow>
              <DetailRow label="Order type">
                {formatOrderTypeLabel(activeItem.orderType)}
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
        {activeItem.orderType?.toLowerCase() === "rent" && paidExtensions.length > 0 && (
          <div className="space-y-1.5 border-t border-border/60 px-3 py-3 text-sm sm:px-4">
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>Original rental</span>
              <span className="tabular-nums">₹{originalRentalAmount.toFixed(2)}</span>
            </div>
            {paidExtensions.map((ext) => (
              <div key={ext.extensionId} className="flex items-center justify-between gap-3">
                <span>Extension · {ext.additionalDays} day{ext.additionalDays === 1 ? "" : "s"}</span>
                <span className="tabular-nums">₹{ext.totalAmount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5 font-semibold">
              <span>Product total</span>
              <span className="tabular-nums">₹{activeItem.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Card>

      {(shownPrescriptionFiles.length > 0 || canUploadPrescription(activeItem.status)) && (
        <OrderPrescriptionFilesCard
          files={shownPrescriptionFiles}
          canEdit={canUploadPrescription(activeItem.status)}
          uploading={uploadRxMut.isPending}
          uploadDisabled={canAddPrescription && !acceptedRxLegal}
          onUpload={(file) => {
            if (!acceptedRxLegal) {
              toast.error("Please agree to the Privacy Policy before uploading a prescription.");
              return;
            }
            uploadRxMut.mutate(file);
          }}
          onDelete={(fileId) => deleteRxMut.mutate(fileId)}
          footer={
            canAddPrescription ? (
              <div className="space-y-2">
                <LegalAgreeCheckbox
                  surface="customer_web"
                  screen="prescription"
                  agreed={acceptedRxLegal}
                  onAgreedChange={setAcceptedRxLegal}
                  prefix="I consent to the"
                  id="order-detail-prescription-terms"
                />
                {!acceptedRxLegal ? (
                  <p className="text-xs text-muted-foreground">
                    Agree to the Privacy Policy before this prescription can be uploaded.
                  </p>
                ) : null}
              </div>
            ) : null
          }
        />
      )}

      {/* Request vendor photos — order-group aware (all items / selected items) */}
      {showPhotosCard && (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1 p-3 pb-2 sm:p-4 sm:pb-2">
            <p className="text-[13px] font-semibold sm:text-base">Request photos from your supplier</p>
            <p className="text-xs text-muted-foreground">
              {orderGroupItems.length > 1
                ? `Photos come from each product’s supplier — up to 3 photos under Option 1, Option 2, and so on. Choose one option.`
                : `Photos come from this product’s supplier — up to 3 photos under Option 1, Option 2, and so on. Choose one option.`}
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
                      {groupPhotoSections.map(({ item, request, images }) => {
                        const waiting = images.length === 0;
                        const isActiveItem = item.id === activeItem.id;
                        const options = request?.options?.length ? request.options : null;
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
                                  : `${images.length} received`}
                              </span>
                            </div>
                            {waiting ? (
                              <p className="text-xs text-muted-foreground">
                                Request already sent for this product — supplier has not uploaded photos yet.
                              </p>
                            ) : options ? (
                              <div className="space-y-3">
                                {request?.selectedOptionId ? (
                                  <p className="text-xs text-muted-foreground">
                                    Your selection:{" "}
                                    <span className="font-semibold text-foreground">
                                      {options.find((o) => o.id === request.selectedOptionId)?.label ?? "an option"}
                                    </span>
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    Select one option for your supplier.
                                  </p>
                                )}
                                <RadioGroup
                                  value={request?.selectedOptionId ?? ""}
                                  onValueChange={(optionId) => {
                                    if (!optionId || optionId === request?.selectedOptionId) return;
                                    const target = options.find((o) => o.id === optionId);
                                    if (!target?.images.length) {
                                      toast.error("Choose an option that already has photos.");
                                      return;
                                    }
                                    selectImageOptionMut.mutate({ orderId: item.id, optionId });
                                  }}
                                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                                  disabled={selectImageOptionMut.isPending}
                                >
                                {options.map((option) => {
                                  const photos = option.images ?? [];
                                  const note = option.description?.trim() ?? "";
                                  const chosen = request?.selectedOptionId === option.id;
                                  const canChoose = photos.length > 0;
                                  return (
                                  <div
                                    key={option.id}
                                    className={cn(
                                      "min-w-0 space-y-2.5 rounded-xl border bg-card p-3 shadow-sm",
                                      chosen
                                        ? "border-primary/35 ring-1 ring-primary/15"
                                        : "border-border/70",
                                    )}
                                  >
                                    <div className="flex min-h-6 items-center gap-2">
                                      <RadioGroupItem
                                        value={option.id}
                                        id={`photo-option-${item.id}-${option.id}`}
                                        disabled={!canChoose || selectImageOptionMut.isPending}
                                        className="shrink-0"
                                      />
                                      <label
                                        htmlFor={`photo-option-${item.id}-${option.id}`}
                                        className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
                                      >
                                        {option.label}
                                      </label>
                                      {chosen ? (
                                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                          Selected
                                        </span>
                                      ) : null}
                                      {note ? (
                                        <Popover
                                          open={openOptionInfoId === option.id}
                                          onOpenChange={(open) => setOpenOptionInfoId(open ? option.id : null)}
                                        >
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                              aria-label={`View description for ${option.label}`}
                                            >
                                              <Info className="h-3.5 w-3.5" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            align="start"
                                            className="w-80 max-w-[calc(100vw-2rem)] p-3"
                                          >
                                            <div className="mb-1 flex items-start justify-between gap-2">
                                              <p className="text-xs font-semibold text-foreground">
                                                {option.label}
                                              </p>
                                              <button
                                                type="button"
                                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                aria-label={`Read ${option.label} description full screen`}
                                                onClick={() => {
                                                  setOpenOptionInfoId(null);
                                                  setOptionNotePreview({
                                                    label: option.label,
                                                    description: note,
                                                  });
                                                }}
                                              >
                                                <Maximize2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                              {note}
                                            </p>
                                            <button
                                              type="button"
                                              className="mt-2 text-xs font-medium text-primary hover:underline"
                                              onClick={() => {
                                                setOpenOptionInfoId(null);
                                                setOptionNotePreview({
                                                  label: option.label,
                                                  description: note,
                                                });
                                              }}
                                            >
                                              Read full screen
                                            </button>
                                          </PopoverContent>
                                        </Popover>
                                      ) : null}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                    {Array.from({ length: request?.maxImagesPerOption ?? 3 }).map((_, slot) => {
                                      const photo = photoAtSlot(photos, slot);
                                      if (photo) {
                                        return (
                                          <OrderOptionPhotoThumb
                                            key={photo.id}
                                            src={orderPhotoTileUrl(photo)}
                                            alt={`Preview ${option.label} for ${item.listingTitle}`}
                                            onPreview={() => setPreviewImageUrl(photo.fileUrl)}
                                          />
                                        );
                                      }
                                      return <OrderOptionEmptySlot key={`${option.id}-empty-${slot}`} />;
                                    })}
                                    </div>
                                  </div>
                                  );
                                })}
                                </RadioGroup>
                              </div>
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
                                      src={orderPhotoTileUrl(img)}
                                      alt={img.originalFileName || item.listingTitle}
                                      loading="lazy"
                                      decoding="async"
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

      <Dialog open={!!optionNotePreview} onOpenChange={(open) => !open && setOptionNotePreview(null)}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[100dvh] sm:max-w-none sm:p-0">
          <DialogHeader className="border-b border-border px-4 py-3 pr-12">
            <DialogTitle className="text-base font-semibold">
              {optionNotePreview?.label ?? "Option description"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
              {optionNotePreview?.description}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <LegalPolicyLinks
        surface="customer_web"
        screen="order_confirm"
        className="w-full border-t border-border/60"
      />

      {awaitingExtension && (
        <Card className="border-orange-200 bg-orange-50 shadow-sm dark:border-orange-900/50 dark:bg-orange-950/20">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div>
              <p className="text-sm font-semibold text-orange-950 dark:text-orange-100">Extension approved</p>
              <p className="mt-1 text-sm text-orange-950/80 dark:text-orange-100/80">
                {awaitingExtension.additionalDays} day{awaitingExtension.additionalDays === 1 ? "" : "s"} for {activeItem.listingTitle}. The end date stays {formatDetailDate(activeItem.endDate)} until this payment succeeds, then it moves to {formatDetailDate(awaitingExtension.newEndDate)}.
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={payExtensionMut.isPending}
              onClick={() => payExtensionMut.mutate(awaitingExtension)}
            >
              {payExtensionMut.isPending ? "Opening payment…" : `Pay ₹${awaitingExtension.totalAmount.toFixed(2)}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingExtension && !awaitingExtension && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="p-3 sm:p-4">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Extension waiting for vendor approval</p>
            <p className="mt-1 text-sm text-amber-950/80 dark:text-amber-100/80">
              {pendingExtension.additionalDays} day{pendingExtension.additionalDays === 1 ? "" : "s"} · ₹{pendingExtension.totalAmount.toFixed(2)}. This amount is not in the order total yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Support and Cancellation Actions for Selected Item */}
      <div className="grid grid-cols-2 gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex sm:flex-wrap sm:gap-3">
        <Button variant="outline" className="w-full justify-center sm:w-auto" asChild>
          <Link
            className="inline-flex items-center justify-center"
            to={`/customer/support?order=${encodeURIComponent(activeItem.orderNumber)}&orderId=${encodeURIComponent(activeItem.id)}`}
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
            onClick={() => setCancelConfirmOpen(true)}
          >
            Cancel item request
          </Button>
        )}

        {activeItem.status.trim().toLowerCase() === "active" && activeItem.orderType.toLowerCase() === "rent" && (
          <div className={cn("col-span-2 grid gap-2 sm:contents", SHOW_CUSTOMER_BUYOUT ? "grid-cols-2" : "grid-cols-1")}>
            <Button
              variant="default"
              className="w-full sm:w-auto"
              disabled={Boolean(awaitingExtension)}
              title={awaitingExtension ? "Pay the approved extension before requesting more days." : undefined}
              onClick={() => {
                setExtensionDays(1);
                setExtensionQuote(null);
                setExtensionDialogOpen(true);
                quoteExtensionMut.mutate(1);
              }}
            >
              Extend Rental
            </Button>
            {SHOW_CUSTOMER_BUYOUT && (
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
            )}
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
              {(extensionQuote?.pendingDays ?? 0) > 0 && (
                <p className="text-sm text-muted-foreground">
                  A {extensionQuote?.pendingDays}-day extension is already waiting for approval. Confirming adds the days above, for {extensionQuote?.additionalDays} days in total.
                </p>
              )}
            </div>

            {!extensionQuote && quoteExtensionMut.isPending ? (
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
                  <span>{formatGstRateLabel(extensionQuote.gstPercent)}:</span>
                  <span>₹{extensionQuote.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold text-foreground">
                  <span>Total Amount:</span>
                  <span>₹{extensionQuote.totalAmount.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payment is taken on this order page after the vendor approves. The end date changes only after that payment.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtensionDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => processExtensionMut.mutate()} 
              disabled={processExtensionMut.isPending || !extensionQuote}
            >
              {processExtensionMut.isPending
                ? "Processing..."
                : (extensionQuote?.pendingDays ?? 0) > 0
                  ? "Update request"
                  : "Request extension"}
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
                  <span>{formatGstRateLabel(buyoutQuote.gstPercent)}:</span>
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

      <CancelOrderConfirm
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        pending={cancelMut.isPending}
        onConfirm={() => {
          if (!activeItem) return;
          cancelMut.mutate(activeItem.id, { onSettled: () => setCancelConfirmOpen(false) });
        }}
      />
    </div>
  );
};

export default CustomerOrderDetail;

