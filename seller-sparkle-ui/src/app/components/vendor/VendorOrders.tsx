import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorOrderApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { Input } from "@/app/components/ui/input";

const PAGE_SIZE = 8;

const statusTabs = [
  { id: "all", label: "All" },
  { id: "awaiting_vendor_acceptance", label: "Awaiting Acceptance" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_transit", label: "In Transit" },
  { id: "active", label: "Active" },
  { id: "returned", label: "Returned" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dispatch_failed", label: "Dispatch Failed" },
] as const;

function matchesVendorStatus(status: string, tabId: (typeof statusTabs)[number]["id"]): boolean {
  if (tabId === "all") return true;
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (tabId === "awaiting_vendor_acceptance") return s === "awaiting vendor acceptance";
  if (tabId === "in_transit") return s.includes("transit");
  if (tabId === "dispatch_failed") return s === "dispatch failed";
  if (tabId === "cancelled") return s === "cancelled" || s === "canceled";
  return s === tabId.replace(/_/g, " ");
}

const VendorOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const initialStatus = searchParams.get("status");
  const isKnownStatus = statusTabs.some((tab) => tab.id === initialStatus);
  const [activeStatus, setActiveStatus] = useState<(typeof statusTabs)[number]["id"]>(
    isKnownStatus ? (initialStatus as (typeof statusTabs)[number]["id"]) : "all",
  );
  const [orders, setOrders] = useState<VendorOrderApiDto[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeStatus]);

  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (urlStatus && statusTabs.some((tab) => tab.id === urlStatus)) {
      setActiveStatus(urlStatus as (typeof statusTabs)[number]["id"]);
    } else if (!urlStatus) {
      setActiveStatus("all");
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus]);

  const loadOrders = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const rows = await vendorOnboardingApi.getVendorOrders(user.id);
      setOrders(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load orders.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [user?.id]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.customerCity && o.customerCity.toLowerCase().includes(q)) ||
          o.orderId.toLowerCase().includes(q),
      );
    }
    return list.filter((o) => matchesVendorStatus(o.status, activeStatus));
  }, [orders, debouncedSearch, activeStatus]);

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => b.orderNumber.localeCompare(a.orderNumber, undefined, { numeric: true })),
    [filteredOrders],
  );

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(
    () => sortedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedOrders, safePage],
  );

  const statusCounts = useMemo(() => {
    let searchable = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      searchable = searchable.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.customerCity && o.customerCity.toLowerCase().includes(q)) ||
          o.orderId.toLowerCase().includes(q),
      );
    }
    return statusTabs.reduce<Record<(typeof statusTabs)[number]["id"], number>>((acc, tab) => {
      acc[tab.id] = tab.id === "all" ? searchable.length : searchable.filter((o) => matchesVendorStatus(o.status, tab.id)).length;
      return acc;
    }, {} as Record<(typeof statusTabs)[number]["id"], number>);
  }, [orders, debouncedSearch]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage confirmed, in-transit, active and completed orders."
        actions={
          <Button variant="outline" onClick={() => void loadOrders()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="relative max-w-2xl mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID, item, or customer"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>

        <Tabs
          value={activeStatus}
          onValueChange={(value) => {
            const nextStatus = value as typeof activeStatus;
            setActiveStatus(nextStatus);
            if (nextStatus === "all") {
              setSearchParams({});
            } else {
              setSearchParams({ status: nextStatus });
            }
          }}
        >
          <TabsList className="mb-4 h-auto w-full flex-wrap justify-start">
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label} ({statusCounts[tab.id] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="mb-4 text-xs text-muted-foreground">
          Status note: <span className="font-medium">Cancelled</span> means customer cancelled the order.
          {" "}
          <span className="font-medium">Dispatch failed</span> means reassignment could not find an eligible vendor.
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4">
                <Skeleton className="h-5 w-44" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders found for this status.</p>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Group pageSlice by their base order number
              const getBaseOrderNumber = (num: string) => num.split('-').slice(0, 3).join('-');
              const groups: Array<{
                baseOrderNumber: string;
                items: VendorOrderApiDto[];
              }> = [];

              pageSlice.forEach((order: VendorOrderApiDto) => {
                const baseNum = getBaseOrderNumber(order.orderNumber);
                let g = groups.find((x) => x.baseOrderNumber === baseNum);
                if (!g) {
                  g = {
                    baseOrderNumber: baseNum,
                    items: [],
                  };
                  groups.push(g);
                }
                g.items.push(order);
              });

              return groups.map((group) => (
                <div key={group.baseOrderNumber} className="rounded-xl border border-border/80 bg-card p-6 shadow-sm hover:border-border/100 transition-all">
                  {/* Group Header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3 mb-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">{group.baseOrderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Consolidated Fulfillment</p>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    {group.items.map((order) => (
                      <div key={order.orderId} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 rounded-lg bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{order.listingTitle}</p>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <p>Customer: <span className="font-medium text-foreground">{order.customerName}</span></p>
                            <p>Qty: <span className="font-medium text-foreground">{order.quantity}</span></p>
                            <p>Total: <span className="font-medium text-foreground">₹{order.totalAmount.toFixed(0)}</span></p>
                            <p>Location: <span className="font-medium text-foreground">{order.customerCity ?? "-"}, {order.customerState ?? "-"}</span></p>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-0 flex items-center justify-between md:justify-end gap-4 border-t border-border/20 md:border-none pt-2 md:pt-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{order.orderType.toUpperCase()}</Badge>
                            <Badge variant="secondary">{order.status}</Badge>
                          </div>
                          <Button size="sm" variant="outline" className="h-8 text-xs border-border/80 font-medium" onClick={() => navigate(`/vendor/orders/${order.orderId}`)}>
                            View details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {safePage} of {totalPages} · {sortedOrders.length} order{sortedOrders.length !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VendorOrders;
