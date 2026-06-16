import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, Package } from "lucide-react";
import { customerApi, type CustomerOrderApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/app/helpers/utils";
import { Badge } from "@/app/components/ui/badge";

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
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatOrderDate(value?: string | null): string {
  if (!value?.trim()) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  if (s === "pending") {
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
          o.vendorName.toLowerCase().includes(q) ||
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
          o.vendorName.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q),
      );
    }

    return STATUS_FILTERS.reduce<Record<StatusFilter, number>>((acc, filter) => {
      acc[filter] = filter === "All" ? searchable.length : searchable.filter((o) => matchesStatusFilter(o.status, filter)).length;
      return acc;
    }, {} as Record<StatusFilter, number>);
  }, [data, debouncedSearch]);

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

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by order ID, item, or vendor"
          className="pl-9"
          aria-label="Search orders"
        />
      </div>

      <div className="-mx-1 overflow-x-auto px-1 sm:-mx-2 sm:px-2">
        <div className="flex min-h-9 gap-2 pb-1">
          {STATUS_FILTERS.map((label) => {
            const selected = appliedFilter === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setAppliedFilter(label)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                {label} ({statusCounts[label] ?? 0})
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Status note: <span className="font-medium">Cancelled</span> means customer cancelled the request.
        {" "}
        <span className="font-medium">Dispatch failed</span> means no replacement vendor was available.
      </p>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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
                  <div key={group.baseOrderNumber} className="overflow-hidden rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-border/100">
                    {/* Group Header */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Group</div>
                        <div className="text-base font-bold text-foreground mt-0.5">{group.baseOrderNumber}</div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
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
                    <div className="space-y-4">
                      {group.items.map((o) => (
                        <div key={o.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/10 hover:border-border transition-all duration-300 shadow-sm gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            {o.primaryImageUrl ? (
                              <img src={o.primaryImageUrl} alt={o.listingTitle} className="h-12 w-12 rounded-lg object-cover border border-border bg-muted shadow-sm" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                                <Package className="h-5 w-5 opacity-60" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/customer/orders/${encodeURIComponent(o.id)}`}
                                className="text-sm font-semibold text-foreground hover:underline block truncate"
                              >
                                {o.listingTitle}
                              </Link>
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1">
                                <span>Period: <strong className="text-foreground font-medium">{formatDateRange(o.startDate, o.endDate)}</strong></span>
                                <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                                <span>Qty: <strong className="text-foreground font-medium">{o.quantity}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-3 sm:pt-0 border-t border-border/20 sm:border-none">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px] font-semibold py-0.5 px-2", orderTypeBadgeClass(o.orderType))} variant="outline">
                                {o.orderType.toUpperCase()}
                              </Badge>
                              <Badge className={cn("text-[10px] font-semibold py-0.5 px-2", orderStatusBadgeClass(o.status))} variant="outline">
                                {o.status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <span className="font-semibold tabular-nums text-sm text-foreground sm:w-20 sm:text-right">₹{o.totalAmount.toFixed(0)}</span>
                            <div className="flex items-center gap-1">
                              {isCustomerOrderCancellable(o.status) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold px-2"
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
                                className="h-8 text-xs font-semibold px-2 hover:bg-accent text-primary transition-colors flex items-center gap-1 group/btn"
                              >
                                <Link to={`/customer/orders/${encodeURIComponent(o.id)}`}>
                                  Details
                                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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
                  <Link to="/customer/browse" className="font-medium text-primary hover:underline">
                    Browse rentals
                  </Link>
                </>
              ) : (
                "No orders match your search or filter."
              )}
            </p>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {safePage} of {totalPages} · {filtered.length} order{filtered.length !== 1 ? "s" : ""}
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
          )}
        </>
      )}
    </div>
  );
};

export default CustomerOrders;
