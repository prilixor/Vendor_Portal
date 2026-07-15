import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorDispatchOfferApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { Clock3, Package, RefreshCw, User } from "lucide-react";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import { useNavigate } from "react-router-dom";
function orderTypeBadgeClass(orderType: string): string {
  const t = orderType.toLowerCase().trim();
  if (t === "buy") {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900";
  }
  return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900";
}

const VendorOrderRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState<VendorDispatchOfferApiDto[]>([]);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadOffers = async (isBackground = false) => {
    if (!user) return;
    try {
      if (!isBackground) setRefreshing(true);
      const rows = await vendorOnboardingApi.getVendorDispatchOffers(user.id);
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

  const sortedOffers = useMemo(
    () =>
      offers
        .filter((offer) => {
          const s = offer.status.trim().toLowerCase();
          return s === "pending" || s.includes("awaiting");
        })
        .sort(
          (a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime(),
        ),
    [offers],
  );

  const handleOfferAction = async (orderId: string, action: "accept" | "reject") => {
    if (!user) return;
    try {
      setWorkingOrderId(orderId);
      if (action === "accept") {
        await vendorOnboardingApi.acceptVendorDispatchOrder(user.id, orderId);
        toast.success("Order request accepted.");
        navigate(`/vendor/orders/${orderId}`);
        return; // Early return to avoid reloading offers since we are navigating away
      } else {
        await vendorOnboardingApi.rejectVendorDispatchOrder(user.id, orderId);
        toast.success("Order request rejected.");
      }
      await loadOffers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update request.";
      toast.error(message);
    } finally {
      setWorkingOrderId(null);
    }
  };

  const formatExpiresIn = (iso: string) => {
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return "Expired";
    const min = Math.ceil(ms / 60000);
    return `${min} min left`;
  };

  return (
    <div>
      <PageHeader
        title="Order Requests"
        description="Accept or reject incoming dispatch requests from customers."
        actions={
          <Button variant="outline" onClick={() => void loadOffers(false)} disabled={initialLoading || refreshing}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4">
                <Skeleton className="h-5 w-40" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedOffers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No pending requests right now.</p>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Group sortedOffers by their base order number
              const getBaseOrderNumber = (num: string) => num.split('-').slice(0, 3).join('-');
              const groups: Array<{
                baseOrderNumber: string;
                expiresAt: string;
                items: VendorDispatchOfferApiDto[];
              }> = [];

              sortedOffers.forEach((offer) => {
                const baseNum = getBaseOrderNumber(offer.orderNumber);
                let g = groups.find((x) => x.baseOrderNumber === baseNum);
                if (!g) {
                  g = {
                    baseOrderNumber: baseNum,
                    expiresAt: offer.expiresAt,
                    items: [],
                  };
                  groups.push(g);
                }
                g.items.push(offer);
                if (new Date(offer.expiresAt).getTime() < new Date(g.expiresAt).getTime()) {
                  g.expiresAt = offer.expiresAt;
                }
              });

              return groups.map((group) => {
                const expired = new Date(group.expiresAt).getTime() <= now;
                return (
                  <div key={group.baseOrderNumber} className="rounded-xl border border-border/80 bg-card p-6 shadow-sm hover:border-border/100 transition-all">
                    {/* Group Header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 mb-4">
                      <div>
                        <p className="text-sm font-bold text-foreground">{group.baseOrderNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Consolidated Request</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={expired ? "destructive" : "secondary"} className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatExpiresIn(group.expiresAt)}
                        </Badge>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                      {group.items.map((offer) => {
                        const itemExpired = new Date(offer.expiresAt).getTime() <= now;
                        const status = offer.status.trim().toLowerCase();
                        const imageUrl = resolveItemImageUrl(offer);
                        return (
                          <div key={offer.offerId} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors gap-3">
                            <div className="flex flex-1 items-start gap-3 min-w-0">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={offer.listingTitle}
                                  className="h-12 w-12 shrink-0 rounded-lg object-cover border border-border bg-muted shadow-sm"
                                />
                              ) : (
                                <div className="h-12 w-12 shrink-0 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                                  <Package className="h-5 w-5 opacity-60" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">{offer.listingTitle}</p>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Qty: <span className="font-medium text-foreground">{offer.quantity}</span></span>
                                {offer.orderType !== "buy" && (
                                  <span>Days: <span className="font-medium text-foreground">{offer.rentalDays}</span></span>
                                )}
                                <span>Payout: <span className="font-medium text-foreground">₹{(offer.vendorSubtotalAmount && offer.vendorSubtotalAmount > 0 ? offer.vendorSubtotalAmount : offer.totalAmount).toFixed(0)}</span></span>
                                <span>Type: <Badge className={cn("text-[10px] px-1.5 py-0 capitalize", orderTypeBadgeClass(offer.orderType))} variant="outline">{offer.orderType}</Badge></span>
                              </div>
                              
                              {(offer.doctorId || offer.hospitalId) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] bg-accent/50 px-2 py-1.5 rounded-md border border-border/50">
                                  <div className="flex items-center gap-1 font-semibold text-muted-foreground">
                                    <User className="h-3 w-3" /> Medical:
                                  </div>
                                  {offer.doctorName && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground uppercase tracking-wide">Dr.</span>
                                      <span className="font-medium text-foreground">
                                        {offer.doctorName}
                                        {offer.doctorSpecialization && <span className="font-normal text-muted-foreground ml-1">- {offer.doctorSpecialization}</span>}
                                      </span>
                                    </div>
                                  )}
                                  {offer.hospitalName && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground uppercase tracking-wide">Hosp.</span>
                                      <span className="font-medium text-foreground">
                                        {offer.hospitalName}
                                        {offer.hospitalCity && <span className="font-normal text-muted-foreground ml-1">({offer.hospitalCity})</span>}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                              </div>
                            </div>

                            <div className="mt-0 flex items-center justify-between md:justify-end gap-4 border-t border-border/20 md:border-none pt-2 md:pt-0">
                              <span className="text-xs font-semibold capitalize text-muted-foreground">
                                {status.replaceAll("_", " ")}
                              </span>
                              <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                    onClick={() => void handleOfferAction(offer.orderId, "accept")}
                                    disabled={itemExpired || workingOrderId === offer.orderId || status !== "pending"}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive font-medium border-border/80"
                                    onClick={() => void handleOfferAction(offer.orderId, "reject")}
                                    disabled={itemExpired || workingOrderId === offer.orderId || status !== "pending"}
                                  >
                                    Reject
                                  </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </Card>
    </div>
  );
};

export default VendorOrderRequests;
