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
import { ChevronLeft, ChevronRight, RefreshCw, Search, Package, User } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/helpers/utils";

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
  { id: "bought_out", label: "Bought Out" },
] as const;

function matchesVendorStatus(status: string, tabId: (typeof statusTabs)[number]["id"]): boolean {
  if (tabId === "all") return true;
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (tabId === "awaiting_vendor_acceptance") return s === "awaiting vendor acceptance";
  if (tabId === "in_transit") return s.includes("transit");
  if (tabId === "dispatch_failed") return s === "dispatch failed";
  if (tabId === "bought_out") return s === "bought out";
  if (tabId === "cancelled") return s === "cancelled" || s === "canceled";
  return s === tabId.replace(/_/g, " ");
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending" || s.includes("awaiting")) {
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
  }
  if (s === "confirmed") {
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900";
  }
  if (s.includes("transit")) {
    return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900";
  }
  if (s === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
  }
  if (s === "returned") {
    return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-800";
  }
  if (s === "cancelled" || s === "canceled") {
    return "bg-muted text-muted-foreground border-border";
  }
  if (s.includes("dispatch failed")) {
    return "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/80";
  }
  if (s === "bought out") {
    return "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900";
  }
  return "bg-muted text-foreground border-border";
}

function orderTypeBadgeClass(orderType: string): string {
  const t = orderType.toLowerCase().trim();
  if (t === "buy") {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900";
  }
  return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900";
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
      [...filteredOrders].sort((a, b) => {
        const timeA = new Date(a.createdAtUtc).getTime();
        const timeB = new Date(b.createdAtUtc).getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return b.orderNumber.localeCompare(a.orderNumber, undefined, { numeric: true });
      }),
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
            {statusTabs
              .filter(tab => tab.id !== "bought_out" || (statusCounts[tab.id] ?? 0) > 0)
              .map((tab) => (
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
                    {group.items[0]?.createdAtUtc && (
                      <div className="text-right sm:text-right">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ordered on: <span className="font-semibold text-foreground">{new Date(group.items[0].createdAtUtc).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    {group.items.map((order) => (
                      <div key={order.orderId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/10 hover:border-border transition-all duration-300 shadow-sm gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          {order.listingPrimaryImageUrl ? (
                            <img
                              src={order.listingPrimaryImageUrl}
                              alt={order.listingTitle}
                              className="h-12 w-12 rounded-lg object-cover border border-border bg-muted shadow-sm"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                              <Package className="h-5 w-5 opacity-60" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{order.listingTitle}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5 opacity-60 shrink-0" /> {order.customerName}
                              </span>
                              <span>Qty: <strong className="text-foreground font-medium">{order.quantity}</strong></span>
                              <span>Total: <strong className="text-foreground font-semibold">₹{order.totalAmount.toFixed(0)}</strong></span>
                              <span>Location: {order.customerCity ?? "-"}, {order.customerState ?? "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-3 sm:pt-0 border-t border-border/20 sm:border-none">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-[10px] font-semibold py-0.5 px-2", orderTypeBadgeClass(order.orderType))} variant="outline">
                              {order.orderType.toUpperCase()}
                            </Badge>
                            <Badge className={cn("text-[10px] font-semibold py-0.5 px-2 capitalize", orderStatusBadgeClass(order.status))} variant="outline">
                              {order.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs font-semibold px-2 hover:bg-accent text-primary transition-colors flex items-center gap-1 group/btn"
                            onClick={() => navigate(`/vendor/orders/${order.orderId}`)}
                          >
                            View details
                            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
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
