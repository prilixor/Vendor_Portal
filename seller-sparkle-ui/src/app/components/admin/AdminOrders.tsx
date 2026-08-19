import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminOrderDto } from "@/app/services/adminApi";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import {
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  AlertCircle,
  Truck,
  Building,
  ChevronRight,
  Package,
} from "lucide-react";
import { formatOrderStatusLabel, formatOrderStatusTitle, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import {
  ActiveFilterChips,
  FilterPanel,
  FilterSearchBar,
  FilterSection,
  FilterSelectRow,
  type ActiveFilterChip,
} from "@/app/components/shared/ProfessionalFilters";

const PAGE_SIZE = 8;

const statusTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_transit", label: "In Transit" },
  { id: "active", label: "Active" },
  { id: "returned", label: "Returned" },
  { id: "bought_out", label: "Bought Out" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dispatch_failed", label: "Dispatch Failed" },
] as const;

function matchesAdminStatus(status: string, tabId: (typeof statusTabs)[number]["id"]): boolean {
  if (tabId === "all") return true;
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (tabId === "pending") return s === "pending" || s === "awaiting vendor acceptance";
  if (tabId === "in_transit") return s.includes("transit");
  if (tabId === "dispatch_failed") return s === "dispatch failed";
  if (tabId === "cancelled") return s === "cancelled" || s === "canceled";
  return s === tabId.replace(/_/g, " ");
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
    return "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/80";
  }
  if (s === "bought out") {
    return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 dark:border-fuchsia-800/50";
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

export const AdminOrders = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as (typeof statusTabs)[number]["id"];
  const isValidTab = statusTabs.some(t => t.id === urlTab);
  
  const [activeTab, setActiveTab] = useState<(typeof statusTabs)[number]["id"]>(
    isValidTab ? urlTab : "all"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftTab, setDraftTab] = useState<(typeof statusTabs)[number]["id"]>("all");

  useEffect(() => {
    if (urlTab && isValidTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [page, setPage] = useState(1);

  const { data: orders = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders({ quiet: true }),
  });

  useEffect(() => {
    const openParam = searchParams.get("open");
    const stateOpenOrderId = (location.state as { openOrderId?: string } | null)?.openOrderId;
    const targetOrderId = stateOpenOrderId || openParam;

    if (targetOrderId) {
      navigate(`/admin/orders/${encodeURIComponent(targetOrderId)}`, { replace: true });
    }
  }, [searchParams, location.state, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  // Statistics Computations
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const active = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s === "active";
    }).length;
    const returned = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s === "returned";
    }).length;
    const failed = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s.includes("dispatch failed");
    }).length;

    return { totalCount, revenue, active, returned, failed };
  }, [orders]);

  // Filtering Logic
  const filtered = useMemo(() => {
    let list = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.vendorName.toLowerCase().includes(q) ||
          o.orderId.toLowerCase().includes(q)
      );
    }
    return list.filter((o) => matchesAdminStatus(o.status, activeTab));
  }, [orders, debouncedSearch, activeTab]);

  const statusCounts = useMemo(() => {
    let searchable = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      searchable = searchable.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.vendorName.toLowerCase().includes(q) ||
          o.orderId.toLowerCase().includes(q)
      );
    }
    return statusTabs.reduce<Record<(typeof statusTabs)[number]["id"], number>>((acc, tab) => {
      acc[tab.id] = tab.id === "all" ? searchable.length : searchable.filter((o) => matchesAdminStatus(o.status, tab.id)).length;
      return acc;
    }, {} as Record<(typeof statusTabs)[number]["id"], number>);
  }, [orders, debouncedSearch]);

  const statusOptions = statusTabs.filter(
    (tab) => tab.id !== "bought_out" || (statusCounts[tab.id] ?? 0) > 0,
  );

  const activeTabLabel = statusTabs.find((t) => t.id === activeTab)?.label ?? "All";
  const activeChips: ActiveFilterChip[] =
    activeTab === "all"
      ? []
      : [
          {
            key: "status",
            label: `${activeTabLabel} (${statusCounts[activeTab] ?? 0})`,
            onClear: () => setActiveTab("all"),
          },
        ];

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  // Grouping by Base Order Number
  const groupedOrders = useMemo(() => {
    const groups: Array<{
      baseOrderNumber: string;
      items: AdminOrderDto[];
      date: string;
      customerName: string;
      customerEmail: string;
      totalAmount: number;
    }> = [];

    pageSlice.forEach((order) => {
      const baseNum = order.orderNumber.split("-").slice(0, 3).join("-");
      let g = groups.find((x) => x.baseOrderNumber === baseNum);
      if (!g) {
        g = {
          baseOrderNumber: baseNum,
          items: [],
          date: order.createdOnUtc,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          totalAmount: 0,
        };
        groups.push(g);
      }
      g.items.push(order);
      g.totalAmount += order.totalAmount;
    });

    return groups;
  }, [pageSlice]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Orders Tracking"
        description="Comprehensive dashboard to check status transitions, split orders, and vendor fulfillment statistics."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching || isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Total Items Ordered</p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight tabular-nums whitespace-nowrap">{stats.totalCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 text-emerald-500 p-2.5">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Platform Revenue</p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight tabular-nums whitespace-nowrap">₹{stats.revenue.toFixed(0)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-500/10 text-indigo-500 p-2.5">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Active Rentals</p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight tabular-nums whitespace-nowrap">{stats.active}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-500/10 text-slate-500 p-2.5">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Completed Rentals</p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight tabular-nums whitespace-nowrap">{stats.returned}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 text-destructive p-2.5">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Dispatch Failed</p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-destructive tabular-nums whitespace-nowrap">{stats.failed}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & List Container */}
      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 max-w-2xl space-y-3">
          <FilterSearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by order prefix, item, customer, or vendor..."
            activeCount={activeTab === "all" ? 0 : 1}
            onOpenFilters={() => {
              setDraftTab(activeTab);
              setFiltersOpen(true);
            }}
            aria-label="Search orders"
          />
          <ActiveFilterChips chips={activeChips} />
        </div>

        <FilterPanel
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Filter orders"
          description="Show orders by current status."
          onReset={() => setDraftTab("all")}
          resetLabel="Clear"
          onApply={() => setActiveTab(draftTab)}
          applyLabel={
            draftTab === "all"
              ? "Show all orders"
              : `Show ${(statusTabs.find((t) => t.id === draftTab)?.label ?? draftTab).toLowerCase()}`
          }
        >
          <FilterSection title="Status">
            {statusOptions.map((tab, index) => (
              <FilterSelectRow
                key={tab.id}
                label={tab.label}
                count={statusCounts[tab.id] ?? 0}
                selected={draftTab === tab.id}
                onClick={() => setDraftTab(tab.id)}
                showDivider={index > 0}
              />
            ))}
          </FilterSection>
        </FilterPanel>

        {isLoading ? (
          <PageLoaderSlot />
        ) : groupedOrders.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No customer orders found matching current criteria.</p>
        ) : (
          <div className="space-y-4">
            {groupedOrders.map((group) => (
              <div key={group.baseOrderNumber} className="rounded-xl border border-border/80 bg-card p-6 shadow-sm hover:border-border/100 transition-all">
                {/* Transaction Group Header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-4 mb-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Group</span>
                    <h4 className="text-base font-bold text-foreground">{group.baseOrderNumber}</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground md:flex md:gap-6">
                    <p>Customer: <span className="font-semibold text-foreground truncate block sm:inline">{group.customerName}</span></p>
                    <p>Email: <span className="font-semibold text-foreground break-all sm:break-normal">{group.customerEmail}</span></p>
                    <p>Placed: <span className="font-semibold text-foreground">{new Date(group.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
                    <p>Combined Total: <span className="font-bold text-primary">₹{group.totalAmount.toFixed(0)}</span></p>
                  </div>
                </div>

                {/* Sub items within order group */}
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const imageUrl = resolveItemImageUrl(item);
                    return (
                    <div key={item.orderId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/10 hover:border-border transition-all duration-300 shadow-sm gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.listingTitle} className="h-12 w-12 rounded-lg object-cover border border-border bg-muted shadow-sm" onError={retryOriginalOnImageError} />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                            <Package className="h-5 w-5 opacity-60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.listingTitle}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5 shrink-0 opacity-60" /> {item.vendorName}</span>
                            <span>Qty: <strong className="text-foreground font-medium">{item.quantity}</strong></span>
                            <span>{item.orderType === "rent" ? `${item.rentalDays} days rental` : "Buyout"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0 pt-3 sm:pt-0 border-t border-border/20 sm:border-none w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("whitespace-nowrap text-[10px] font-semibold py-0.5 px-2", orderTypeBadgeClass(item.orderType))} variant="outline">
                            {item.orderType.toUpperCase()}
                          </Badge>
                          {item.isExtended && (
                            <Badge className="whitespace-nowrap text-[10px] font-bold py-0.5 px-2 bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/50" variant="outline">
                              EXTENDED
                            </Badge>
                          )}
                          <Badge
                            title={formatOrderStatusTitle(item.status)}
                            className={cn(orderStatusBadgeSizeClass, orderStatusBadgeClass(item.status))}
                            variant="outline"
                          >
                            {formatOrderStatusLabel(item.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-sm text-foreground sm:w-20 sm:text-right">₹{item.totalAmount.toFixed(0)}</span>
                          <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-semibold px-2 hover:bg-accent text-primary transition-colors flex items-center gap-1 group/btn"
                          onClick={() => navigate(`/admin/orders/${encodeURIComponent(item.orderId)}`)}
                        >
                          View details
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages} · {filtered.length} order item{filtered.length !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminOrders;
