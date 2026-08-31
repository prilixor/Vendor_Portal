import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { ListingThumb } from "@/app/components/shared/ListingThumb";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorOrderApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { ChevronRight, RefreshCw, User } from "lucide-react";
import { formatOrderStatusLabel, formatOrderStatusTitle, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import {
  ActiveFilterChips,
  FilterPanel,
  FilterSearchBar,
  FilterSection,
  FilterSelectRow,
  type ActiveFilterChip,
} from "@/app/components/shared/ProfessionalFilters";

const PAGE_SIZE = 8;

function getBaseOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").slice(0, 3).join("-");
}

function countOrderGroups(orders: VendorOrderApiDto[]): number {
  const bases = new Set<string>();
  for (const order of orders) {
    bases.add(getBaseOrderNumber(order.orderNumber));
  }
  return bases.size;
}

function formatOrderItemSummary(groupCount: number, itemCount: number): string {
  const ordersLabel = `${groupCount} order${groupCount !== 1 ? "s" : ""}`;
  const itemsLabel = `${itemCount} item${itemCount !== 1 ? "s" : ""}`;
  return `${ordersLabel} · ${itemsLabel}`;
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState<(typeof statusTabs)[number]["id"]>("all");

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

  const orderGroupCount = useMemo(() => countOrderGroups(sortedOrders), [sortedOrders]);
  const itemCount = sortedOrders.length;

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

  const setStatusFilter = (nextStatus: (typeof statusTabs)[number]["id"]) => {
    setActiveStatus(nextStatus);
    if (nextStatus === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ status: nextStatus });
    }
  };

  const statusOptions = statusTabs.filter(
    (tab) => tab.id !== "bought_out" || (statusCounts[tab.id] ?? 0) > 0,
  );

  const activeTabLabel = statusTabs.find((t) => t.id === activeStatus)?.label ?? "All";
  const activeChips: ActiveFilterChip[] =
    activeStatus === "all"
      ? []
      : [
          {
            key: "status",
            label: `${activeTabLabel} (${statusCounts[activeStatus] ?? 0})`,
            onClear: () => setStatusFilter("all"),
          },
        ];

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
        <div className="mb-6 max-w-2xl space-y-3">
          <FilterSearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by order ID, item, or customer"
            mobilePlaceholder="Search orders"
            activeCount={activeStatus === "all" ? 0 : 1}
            onOpenFilters={() => {
              setDraftStatus(activeStatus);
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
          onReset={() => setDraftStatus("all")}
          resetLabel="Clear"
          onApply={() => setStatusFilter(draftStatus)}
          applyLabel={
            draftStatus === "all"
              ? "Show all orders"
              : `Show ${(statusTabs.find((t) => t.id === draftStatus)?.label ?? draftStatus).toLowerCase()}`
          }
        >
          <FilterSection title="Status">
            {statusOptions.map((tab, index) => (
              <FilterSelectRow
                key={tab.id}
                label={tab.label}
                count={statusCounts[tab.id] ?? 0}
                selected={draftStatus === tab.id}
                onClick={() => setDraftStatus(tab.id)}
                showDivider={index > 0}
              />
            ))}
          </FilterSection>
        </FilterPanel>

        <p className="mb-4 text-xs text-muted-foreground">
          Status note: <span className="font-medium">Cancelled</span> means customer cancelled the order.
          {" "}
          <span className="font-medium">Dispatch failed</span> means reassignment could not find an eligible vendor.
        </p>

        {!loading && itemCount > 0 ? (
          <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{formatOrderItemSummary(orderGroupCount, itemCount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Grouped by order ID — each card is one checkout; rows inside are line items.
            </p>
          </div>
        ) : null}

        {loading ? (
          <PageLoaderSlot />
        ) : sortedOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders found for this status.</p>
        ) : (
          <div className="space-y-3">
            {(() => {
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
                <div key={group.baseOrderNumber} className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border/100 sm:p-6">
                  {/* Group Header */}
                  <div className="mb-4 flex flex-col gap-2 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-bold text-foreground">{group.baseOrderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Consolidated fulfillment · {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    {group.items[0]?.createdAtUtc && (
                      <div className="text-left sm:text-right mt-1 sm:mt-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ordered on: <span className="font-semibold text-foreground">{new Date(group.items[0].createdAtUtc).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    {group.items.map((order) => {
                      const imageUrl = resolveItemImageUrl(order);
                      return (
                      <div key={order.orderId} className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-all duration-300 hover:border-border hover:bg-accent/10 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          <ListingThumb src={imageUrl} size="lg" className="border border-border shadow-sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate">{order.listingTitle}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5 opacity-60 shrink-0" /> {order.customerName}
                              </span>
                              <span>Qty: <strong className="text-foreground font-medium">{order.quantity}</strong></span>
                              <span>Payout: <strong className="text-foreground font-semibold">₹{(order.vendorSubtotalAmount && order.vendorSubtotalAmount > 0 ? order.vendorSubtotalAmount : order.totalAmount).toFixed(0)}</strong></span>
                              <span>Location: {order.customerCity ?? "-"}, {order.customerState ?? "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 border-t border-border/20 pt-3 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-3 sm:border-none sm:pt-0">
                          <div className="flex items-center gap-1.5">
                            <Badge className={cn("whitespace-nowrap text-[10px] font-semibold py-0.5 px-2", orderTypeBadgeClass(order.orderType))} variant="outline">
                              {order.orderType.toUpperCase()}
                            </Badge>
                            <Badge
                              title={formatOrderStatusTitle(order.status)}
                              className={cn(orderStatusBadgeSizeClass, orderStatusBadgeClass(order.status))}
                              variant="outline"
                            >
                              {formatOrderStatusLabel(order.status)}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 px-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent sm:h-8 sm:px-2"
                            onClick={() => navigate(`/vendor/orders/${order.orderId}`)}
                          >
                            <span className="sm:hidden">Details</span>
                            <span className="hidden sm:inline">View details</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              ));
            })()}
            <TablePagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={sortedOrders.length}
              onPageChange={setPage}
              label="order items"
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default VendorOrders;
