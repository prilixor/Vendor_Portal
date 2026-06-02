import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorDispatchOfferApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { Clock3, RefreshCw } from "lucide-react";

const VendorOrderRequests = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<VendorDispatchOfferApiDto[]>([]);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);

  const loadOffers = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const rows = await vendorOnboardingApi.getVendorDispatchOffers(user.id);
      setOffers(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load order requests.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOffers();
    const timer = window.setInterval(() => void loadOffers(), 20000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const sortedOffers = useMemo(
    () =>
      [...offers].sort(
        (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
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
    const ms = new Date(iso).getTime() - Date.now();
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
          <Button variant="outline" onClick={() => void loadOffers()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loading ? (
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
                const expired = new Date(group.expiresAt).getTime() <= Date.now();
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
                        const itemExpired = new Date(offer.expiresAt).getTime() <= Date.now();
                        const status = offer.status.trim().toLowerCase();
                        return (
                          <div key={offer.offerId} className="flex flex-col md:flex-row md:items-center md:justify-between p-3 rounded-lg bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground">{offer.listingTitle}</p>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Qty: <span className="font-medium text-foreground">{offer.quantity}</span></span>
                                <span>Days: <span className="font-medium text-foreground">{offer.rentalDays}</span></span>
                                <span>Total: <span className="font-medium text-foreground">₹{offer.totalAmount.toFixed(0)}</span></span>
                                <span>Type: <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{offer.orderType}</Badge></span>
                              </div>
                            </div>

                            <div className="mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-4 border-t border-border/20 md:border-none pt-2 md:pt-0">
                              <span className="text-xs font-semibold capitalize text-muted-foreground">
                                {status.replaceAll("_", " ")}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  onClick={() => void handleOfferAction(offer.orderId, "accept")}
                                  disabled={itemExpired || workingOrderId === offer.orderId}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive font-medium border-border/80"
                                  onClick={() => void handleOfferAction(offer.orderId, "reject")}
                                  disabled={itemExpired || workingOrderId === offer.orderId}
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
