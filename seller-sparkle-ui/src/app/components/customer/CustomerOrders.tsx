import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { customerApi, type CustomerOrderApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/app/helpers/utils";

const PAGE_SIZE = 8;

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Confirmed",
  "In transit",
  "Active",
  "Returned",
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
  const s = status.toLowerCase();
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
  return "bg-muted text-foreground";
}

const CustomerOrders = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<StatusFilter>("All");
  const [page, setPage] = useState(1);

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
    if (appliedFilter !== "All") {
      list = list.filter((o) => o.status.toLowerCase() === appliedFilter.toLowerCase());
    }
    return list;
  }, [data, debouncedSearch, appliedFilter]);

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
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <>
          {filtered.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
              <Table>
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Listing</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dates</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageSlice.map((o: CustomerOrderApi) => (
                  <TableRow key={o.id} className="border-b border-border/60">
                    <TableCell className="font-medium">
                      <Link
                        to={`/customer/orders/${encodeURIComponent(o.id)}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{o.listingTitle}</TableCell>
                    <TableCell className="text-muted-foreground">{o.vendorName}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          orderStatusBadgeClass(o.status),
                        )}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums text-xs sm:text-sm">
                      {formatDateRange(o.startDate, o.endDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">₹{o.totalAmount.toFixed(0)}</TableCell>
                    <TableCell className="text-right">
                      {o.status.toLowerCase() === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={cancelMut.isPending}
                          onClick={() => cancelMut.mutate(o.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
