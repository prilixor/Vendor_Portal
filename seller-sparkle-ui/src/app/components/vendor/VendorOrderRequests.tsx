import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorDispatchOfferApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  Inbox,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { cn, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import { useNavigate } from "react-router-dom";
import { VendorDoctorLookupDialog } from "@/app/components/vendor/VendorDoctorLookupDialog";

const COLLAPSE_AFTER = 3;

type OfferGroup = {
  baseOrderNumber: string;
  expiresAt: string;
  items: VendorDispatchOfferApiDto[];
};

type TypeFilter = "all" | "rent" | "buy";

function orderTypeBadgeClass(orderType: string): string {
  const t = orderType.toLowerCase().trim();
  if (t === "buy") {
    return "bg-indigo-500/15 text-indigo-300 border-indigo-500/35";
  }
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
}

function getBaseOrderNumber(orderNumber: string): string {
  const parts = orderNumber.split("-");
  return parts.length >= 3 ? parts.slice(0, 3).join("-") : orderNumber;
}

function getPayoutAmount(offer: VendorDispatchOfferApiDto): number {
  return offer.vendorSubtotalAmount && offer.vendorSubtotalAmount > 0
    ? offer.vendorSubtotalAmount
    : offer.totalAmount;
}

function formatExpiresIn(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Expired";
  const min = Math.ceil(ms / 60000);
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
  }
  return `${min} min left`;
}

function matchesSearch(offer: VendorDispatchOfferApiDto, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    offer.orderNumber.toLowerCase().includes(q) ||
    offer.listingTitle.toLowerCase().includes(q) ||
    (offer.doctorName?.toLowerCase().includes(q) ?? false) ||
    (offer.doctorUniqueCode?.toLowerCase().includes(q) ?? false) ||
    (offer.hospitalName?.toLowerCase().includes(q) ?? false) ||
    (offer.hospitalCity?.toLowerCase().includes(q) ?? false)
  );
}

function isPendingOffer(offer: VendorDispatchOfferApiDto): boolean {
  const s = offer.status.trim().toLowerCase();
  return s === "pending" || s.includes("awaiting");
}

const VendorOrderRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<VendorDispatchOfferApiDto[]>([]);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [doctorLookupOpen, setDoctorLookupOpen] = useState(false);
  const [doctorLookupCode, setDoctorLookupCode] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [rejectOffer, setRejectOffer] = useState<VendorDispatchOfferApiDto | null>(null);

  const loadOffers = async (isBackground = false) => {
    if (!user) return;
    try {
      if (!isBackground) setRefreshing(true);
      const rows = await vendorOnboardingApi.getVendorDispatchOffers(user.id, {
        quiet: isBackground,
      });
      setOffers(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load order requests.";
      toast.error(message);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOffers(false);
    const timer = window.setInterval(() => void loadOffers(true), 20000);
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(ticker);
    };
  }, [user?.id]);

  const pendingOffers = useMemo(
    () => offers.filter(isPendingOffer),
    [offers],
  );

  const typeCounts = useMemo(
    () => ({
      all: pendingOffers.length,
      rent: pendingOffers.filter((o) => o.orderType.toLowerCase() === "rent").length,
      buy: pendingOffers.filter((o) => o.orderType.toLowerCase() === "buy").length,
    }),
    [pendingOffers],
  );

  const groups = useMemo(() => {
    const built: OfferGroup[] = [];
    const q = searchQuery.trim().toLowerCase();

    pendingOffers.forEach((offer) => {
      if (!matchesSearch(offer, q)) return;
      if (typeFilter !== "all" && offer.orderType.toLowerCase() !== typeFilter) return;

      const base = getBaseOrderNumber(offer.orderNumber);
      let group = built.find((g) => g.baseOrderNumber === base);
      if (!group) {
        group = { baseOrderNumber: base, expiresAt: offer.expiresAt, items: [] };
        built.push(group);
      }
      group.items.push(offer);
      if (new Date(offer.expiresAt).getTime() < new Date(group.expiresAt).getTime()) {
        group.expiresAt = offer.expiresAt;
      }
    });

    return built.sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    );
  }, [pendingOffers, searchQuery, typeFilter]);

  const totalItems = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups],
  );

  const totalPayout = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.reduce((n, o) => n + getPayoutAmount(o), 0), 0),
    [groups],
  );

  const toggleExpanded = (baseOrderNumber: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(baseOrderNumber)) next.delete(baseOrderNumber);
      else next.add(baseOrderNumber);
      return next;
    });
  };

  const handleOfferAction = async (orderId: string, action: "accept" | "reject") => {
    if (!user) return;
    try {
      setWorkingOrderId(orderId);
      if (action === "accept") {
        await vendorOnboardingApi.acceptVendorDispatchOrder(user.id, orderId);
        toast.success("Order request accepted.");
        navigate(`/vendor/orders/${orderId}`);
        return;
      }
      await vendorOnboardingApi.rejectVendorDispatchOrder(user.id, orderId);
      toast.success("Order request rejected.");
      await loadOffers(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update request.";
      toast.error(message);
    } finally {
      setWorkingOrderId(null);
      setRejectOffer(null);
    }
  };

  const hasActiveFilters = searchQuery.trim().length > 0 || typeFilter !== "all";

  return (
    <div>
      <PageHeader
        title="Order Requests"
        description="Review incoming dispatch offers and accept or reject before the timer expires."
        showBreadcrumbs={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDoctorLookupCode("");
                setDoctorLookupOpen(true);
              }}
            >
              <Stethoscope className="mr-2 h-4 w-4" />
              Find doctor
            </Button>
            <Button
              variant="outline"
              onClick={() => void loadOffers(false)}
              disabled={initialLoading || refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-muted/20 p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary sm:h-14 sm:w-14">
              <Inbox className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground sm:text-lg">
                {groups.length === 0
                  ? "Waiting for requests"
                  : `${groups.length} ${groups.length === 1 ? "request" : "requests"} · ${totalItems} ${totalItems === 1 ? "item" : "items"}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {groups.length === 0
                  ? "Accept or reject incoming dispatch offers as they arrive."
                  : `Potential payout ₹${totalPayout.toFixed(0)} across active offers.`}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order, listing, doctor, hospital…"
              className="h-11 rounded-xl border-border/60 bg-background pl-10 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "rent", "buy"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTypeFilter(filter)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold capitalize transition-colors",
                  typeFilter === filter
                    ? "border-primary/60 bg-primary/15 text-foreground shadow-sm"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-accent/40",
                )}
              >
                {filter} ({typeCounts[filter]})
              </button>
            ))}
          </div>
        </div>

      {initialLoading ? (
        <PageLoaderSlot />
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-6 py-16 text-center">
          <ClipboardList className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-base font-semibold text-foreground">
            {hasActiveFilters ? "No requests match your filters." : "No pending requests right now."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            New customer dispatch offers will appear here.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => void loadOffers(false)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          {groups.map((group) => {
            const expired = new Date(group.expiresAt).getTime() <= now;
            const urgent =
              !expired && new Date(group.expiresAt).getTime() - now <= 10 * 60 * 1000;
            const expanded = expandedGroups.has(group.baseOrderNumber);
            const visibleItems =
              expanded || group.items.length <= COLLAPSE_AFTER
                ? group.items
                : group.items.slice(0, COLLAPSE_AFTER - 1);
            const hiddenCount = group.items.length - visibleItems.length;
            const groupPayout = group.items.reduce((sum, o) => sum + getPayoutAmount(o), 0);

            return (
              <div
                key={group.baseOrderNumber}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card shadow-sm transition-colors",
                  urgent ? "border-amber-500/45 shadow-amber-500/5" : "border-border/80",
                )}
              >
                <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-foreground">{group.baseOrderNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Consolidated fulfillment · {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "items"}
                      <span className="ml-2 font-semibold text-primary">₹{groupPayout.toFixed(0)}</span>
                    </p>
                  </div>
                  <TimerPill
                    label={formatExpiresIn(group.expiresAt, now)}
                    expired={expired}
                    urgent={urgent}
                  />
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  {visibleItems.map((offer) => {
                    const itemExpired = new Date(offer.expiresAt).getTime() <= now;
                    const status = offer.status.trim().toLowerCase();
                    const imageUrl = resolveItemImageUrl(offer);
                    const disabled =
                      itemExpired || workingOrderId === offer.orderId || status !== "pending";
                    const working = workingOrderId === offer.orderId;

                    return (
                      <div
                        key={offer.offerId}
                        className="flex flex-col gap-4 rounded-xl border border-border/50 bg-background/60 p-4 shadow-sm transition-colors hover:border-border hover:bg-accent/10 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={offer.listingTitle}
                              className="h-14 w-14 shrink-0 rounded-lg border border-border/60 object-cover bg-muted shadow-sm sm:h-16 sm:w-16"
                              onError={retryOriginalOnImageError}
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted text-muted-foreground shadow-sm sm:h-16 sm:w-16">
                              <Package className="h-6 w-6 opacity-60" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-foreground sm:text-lg">
                              {offer.listingTitle}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <MetaChip label={`Qty ${offer.quantity}`} />
                              {offer.orderType.toLowerCase() !== "buy" && (
                                <MetaChip
                                  label={
                                    offer.rentalDurationLabel
                                      ? offer.rentalDurationLabel
                                      : `${offer.rentalDays} ${
                                          offer.rentalPeriodUnit === "week"
                                            ? "weeks"
                                            : offer.rentalPeriodUnit === "month"
                                              ? "months"
                                              : "days"
                                        }`
                                  }
                                />
                              )}
                              <MetaChip label={`₹${getPayoutAmount(offer).toFixed(0)}`} highlight />
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-semibold capitalize",
                                  orderTypeBadgeClass(offer.orderType),
                                )}
                              >
                                {offer.orderType}
                              </Badge>
                            </div>

                            {(offer.doctorName || offer.hospitalName || offer.doctorUniqueCode) && (
                              <button
                                type="button"
                                className="mt-3 flex w-full items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-left text-sm text-muted-foreground transition hover:border-teal-300 hover:bg-teal-50/50 hover:text-foreground"
                                onClick={() => {
                                  if (!offer.doctorUniqueCode) return;
                                  setDoctorLookupCode(offer.doctorUniqueCode);
                                  setDoctorLookupOpen(true);
                                }}
                                disabled={!offer.doctorUniqueCode}
                                title={offer.doctorUniqueCode ? "View doctor profile" : undefined}
                              >
                                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" />
                                <span className="line-clamp-2">
                                  {[
                                    offer.doctorName
                                      ? `Dr. ${offer.doctorName}${offer.doctorSpecialization ? ` · ${offer.doctorSpecialization}` : ""}${offer.doctorUniqueCode ? ` · ${offer.doctorUniqueCode}` : ""}`
                                      : null,
                                    offer.hospitalName
                                      ? `${offer.hospitalName}${offer.hospitalCity ? ` (${offer.hospitalCity})` : ""}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                  {offer.doctorUniqueCode ? " · Tap to view" : ""}
                                </span>
                              </button>
                            )}

                            {itemExpired && (
                              <p className="mt-2 text-sm font-semibold text-destructive">
                                {formatExpiresIn(offer.expiresAt, now)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 border-t border-border/30 pt-3 lg:flex-col lg:border-t-0 lg:pt-0 xl:flex-row">
                          <Button
                            size="sm"
                            className="min-w-[108px] bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={disabled}
                            onClick={() => void handleOfferAction(offer.orderId, "accept")}
                          >
                            {working ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-4 w-4" />
                            )}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-w-[108px] border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={disabled}
                            onClick={() => setRejectOffer(offer)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(hiddenCount > 0 || expanded) && (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(group.baseOrderNumber)}
                    className="flex w-full items-center justify-center gap-1 border-t border-border/40 py-3 text-sm font-semibold text-primary hover:bg-accent/20"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show {hiddenCount} more {hiddenCount === 1 ? "item" : "items"}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </Card>

      <AlertDialog open={rejectOffer != null} onOpenChange={(open) => !open && setRejectOffer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject request?</AlertDialogTitle>
            <AlertDialogDescription>
              Decline {rejectOffer?.listingTitle}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rejectOffer && void handleOfferAction(rejectOffer.orderId, "reject")}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VendorDoctorLookupDialog
        open={doctorLookupOpen}
        onOpenChange={setDoctorLookupOpen}
        initialCode={doctorLookupCode}
      />
    </div>
  );
};

function TimerPill({
  label,
  expired,
  urgent,
}: {
  label: string;
  expired: boolean;
  urgent: boolean;
}) {
  const colorClass = expired
    ? "border-destructive/35 bg-destructive/10 text-destructive"
    : urgent
      ? "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-400";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        colorClass,
      )}
    >
      <Clock3 className="h-4 w-4" />
      {label}
    </span>
  );
}

function MetaChip({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export default VendorOrderRequests;
