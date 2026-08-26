import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { customerApi, type CustomerOrderApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ListPager } from "@/app/components/shared/ListPager";
import { ListingThumb } from "@/app/components/shared/ListingThumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { toast } from "sonner";
import { formatCustomerOrderStatusTitle, formatOrderStatusLabel, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import { Badge } from "@/app/components/ui/badge";
import {
  ActiveFilterChips,
  FilterPanel,
  FilterSearchBar,
  FilterSection,
  FilterSelectRow,
  type ActiveFilterChip,
} from "@/app/components/shared/ProfessionalFilters";

const PAGE_SIZE = 8;

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Confirmed",
  "In transit",
  "Active",
  "Returned",
  "Dispatch failed",
  "Cancelled",
  "Bought Out",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatOrderDate(value?: string | null): string {
  if (!value?.trim()) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function compactDurationLabel(label?: string | null): string {
  if (!label?.trim()) return "";
  return label
    .replace(/\s*Billing Cycles?/gi, " cycles")
    .replace(/\s*Billing Cycle/gi, " cycle")
    .trim();
}

function formatDateRange(start?: string | null, end?: string | null): string {
  const a = formatOrderDate(start);
  const b = formatOrderDate(end);
  if (a && b) return `${a} → ${b}`;
  if (a) return a;
  if (b) return b;
  return "—";
}

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

function orderTypeBadgeClass(orderType: string): string {
  const t = orderType.toLowerCase().trim();
  if (t === "buy") {
    return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900";
  }
  return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900";
}

function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "All") return true;

  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (filter === "Pending") {
    return s === "pending" || s === "awaiting vendor acceptance";
  }
  if (filter === "In transit") {
    return s.includes("transit");
  }
  if (filter === "Cancelled") {
    return s === "cancelled" || s === "canceled";
  }
  if (filter === "Dispatch failed") {
    return s === "dispatch failed";
  }
  if (filter === "Bought Out") {
    return s === "bought out";
  }
  return s === filter.toLowerCase();
}

function isCustomerOrderCancellable(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "pending" || s === "awaiting vendor acceptance";
}

const CustomerOrders = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") as StatusFilter;
  
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [appliedFilter, setAppliedFilter] = useState<StatusFilter>(
    initialStatus && STATUS_FILTERS.includes(initialStatus) ? initialStatus : "All"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<StatusFilter>("All");

  useEffect(() => {
    const s = searchParams.get("status") as StatusFilter;
    if (s && STATUS_FILTERS.includes(s)) {
      setAppliedFilter(s);
    } else if (!s) {
      setAppliedFilter("All");
    }
  }, [searchParams]);

  const handleFilterChange = (label: StatusFilter) => {
    setAppliedFilter(label);
    if (label === "All") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", label);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const openFilters = () => {
    setDraftFilter(appliedFilter);
    setFiltersOpen(true);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, appliedFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => customerApi.getOrders(),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => customerApi.cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      toast.success("Order cancelled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    let list = data ?? [];
    const q = debouncedSearch.toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    }
    list = list.filter((o) => matchesStatusFilter(o.status, appliedFilter));
    return list;
  }, [data, debouncedSearch, appliedFilter]);

  const statusCounts = useMemo(() => {
    let searchable = data ?? [];
    const q = debouncedSearch.toLowerCase();
    if (q) {
      searchable = searchable.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    }

    return STATUS_FILTERS.reduce<Record<StatusFilter, number>>((acc, filter) => {
      acc[filter] = filter === "All" ? searchable.length : searchable.filter((o) => matchesStatusFilter(o.status, filter)).length;
      return acc;
    }, {} as Record<StatusFilter, number>);
  }, [data, debouncedSearch]);

  const statusOptions = STATUS_FILTERS.filter(
    (label) => label !== "Bought Out" || (statusCounts["Bought Out"] ?? 0) > 0,
  );

  const activeChips: ActiveFilterChip[] =
    appliedFilter === "All"
      ? []
      : [
          {
            key: "status",
            label: `${appliedFilter} (${statusCounts[appliedFilter] ?? 0})`,
            onClear: () => handleFilterChange("All"),
          },
        ];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  if (error) {
    return <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load orders."}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track every rental from request through return.</p>
      </div>

      <div className="max-w-2xl space-y-3">
        <FilterSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by order ID, item, or supplier"
          mobilePlaceholder="Search orders"
          activeCount={appliedFilter === "All" ? 0 : 1}
          onOpenFilters={openFilters}
          aria-label="Search orders"
        />
        <ActiveFilterChips chips={activeChips} />
      </div>

      <FilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filter orders"
        description="Show orders by current status."
        onReset={() => setDraftFilter("All")}
        resetLabel="Clear"
        onApply={() => handleFilterChange(draftFilter)}
        applyLabel={draftFilter === "All" ? "Show all orders" : `Show ${draftFilter.toLowerCase()}`}
      >
        <FilterSection title="Status">
          {statusOptions.map((label, index) => (
            <FilterSelectRow
              key={label}
              label={label}
              count={statusCounts[label] ?? 0}
              selected={draftFilter === label}
              onClick={() => setDraftFilter(label)}
              showDivider={index > 0}
            />
          ))}
        </FilterSection>
      </FilterPanel>

      <p className="text-xs text-muted-foreground">
        Status note: <span className="font-medium">Cancelled</span> means customer cancelled the request.
        {" "}
        <span className="font-medium">Dispatch failed</span> means no replacement supplier was available.
      </p>

      {isLoading ? (
        <PageLoaderSlot />
      ) : (
        <>
          {filtered.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                // Group the pageSlice items by their baseOrderNumber prefix
                const groups: Array<{
                  baseOrderNumber: string;
                  items: CustomerOrderApi[];
                  date: string;
                  totalAmount: number;
                  isCancellable: boolean;
                }> = [];

                pageSlice.forEach((o: CustomerOrderApi) => {
                  const baseNum = o.orderNumber.split('-').slice(0, 3).join('-');
                  let g = groups.find((x) => x.baseOrderNumber === baseNum);
                  if (!g) {
                    g = {
                      baseOrderNumber: baseNum,
                      items: [],
                      date: o.startDate || "",
                      totalAmount: 0,
                      isCancellable: false,
                    };
                    groups.push(g);
                  }
                  g.items.push(o);
                  g.totalAmount += o.totalAmount;
                  g.isCancellable = g.isCancellable || isCustomerOrderCancellable(o.status);
                });

                return groups.map((group) => (
                  <div key={group.baseOrderNumber} className="overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border/100 sm:p-6">
                    {/* Group Header */}
                    <div className="mb-3 border-b border-border/60 pb-3 sm:mb-4 sm:flex sm:items-center sm:justify-between sm:pb-4">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Group</div>
                        <div className="mt-0.5 truncate text-base font-bold text-foreground">{group.baseOrderNumber}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs sm:mt-0 sm:justify-end sm:gap-4 sm:text-sm">
                        <div>
                          <span className="text-muted-foreground">Placed On:</span>{" "}
                          <span className="font-semibold text-foreground">{formatOrderDate(group.date)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Paid:</span>{" "}
                          <span className="font-semibold text-foreground">₹{group.totalAmount.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Group Items */}
                    <div className="space-y-3 sm:space-y-4">
                      {group.items.map((o) => {
                        const imageUrl = resolveItemImageUrl(o);
                        const durationText = compactDurationLabel(o.rentalDurationLabel);
                        return (
                        <div key={o.id} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-all duration-300 hover:border-border hover:bg-accent/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <ListingThumb src={imageUrl} size="lg" className="border border-border shadow-sm" />
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/customer/orders/${encodeURIComponent(o.id)}`}
                                className="block truncate text-sm font-semibold text-foreground hover:underline"
                              >
                                {o.listingTitle}
                              </Link>
                              {o.orderType?.toLowerCase() === "buy" ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {formatOrderDate(o.startDate)}
                                  <span className="text-muted-foreground/40"> · </span>
                                  Qty {o.quantity}
                                </p>
                              ) : (
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  <p className="truncate">
                                    {formatDateRange(o.startDate, o.endDate)}
                                  </p>
                                  <p className="truncate">
                                    {durationText ? `${durationText} · ` : null}
                                    Qty {o.quantity}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-1 border-t border-border/20 pt-3 sm:w-auto sm:justify-end sm:gap-3 sm:border-none sm:pt-0">
                            <div className="flex min-w-0 flex-nowrap items-center gap-1">
                              <Badge className={cn("h-5 shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-semibold leading-none sm:px-2", orderTypeBadgeClass(o.orderType))} variant="outline">
                                {o.orderType.toUpperCase()}
                              </Badge>
                              <Badge
                                title={formatCustomerOrderStatusTitle(o.status)}
                                className={cn("shrink-0", orderStatusBadgeSizeClass, "px-1.5 sm:px-2", orderStatusBadgeClass(o.status))}
                                variant="outline"
                              >
                                {formatOrderStatusLabel(o.status)}
                              </Badge>
                            </div>
                            <div className="flex shrink-0 flex-nowrap items-center gap-1 sm:gap-3">
                              <span className="text-xs font-semibold tabular-nums text-foreground sm:text-sm">₹{o.totalAmount.toFixed(0)}</span>
                              {isCustomerOrderCancellable(o.status) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 shrink-0 px-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:px-2"
                                  disabled={cancelMut.isPending}
                                  onClick={() => cancelMut.mutate(o.id)}
                                >
                                  Cancel
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                className="group/btn flex h-7 shrink-0 items-center gap-0.5 px-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent sm:h-8 sm:gap-1 sm:px-2"
                              >
                                <Link to={`/customer/orders/${encodeURIComponent(o.id)}`}>
                                  Details
                                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : null}

          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {data?.length === 0 ? (
                <>
                  No orders yet.{" "}
                  <Link to="/customer/shop" className="font-medium text-primary hover:underline">
                    Continue shopping
                  </Link>
                </>
              ) : (
                "No orders match your search or filter."
              )}
            </p>
          )}

          {filtered.length > 0 && (
            <ListPager
              page={safePage}
              totalPages={totalPages}
              summary={`Page ${safePage} of ${totalPages} · ${filtered.length} order${filtered.length !== 1 ? "s" : ""}`}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CustomerOrders;
