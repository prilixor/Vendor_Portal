import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { adminApi, type AdminExpiringOrderDto } from "@/app/services/adminApi";

const PAGE_SIZE = 8;

function getBaseOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").slice(0, 3).join("-");
}

function resolveDaysLeft(row: AdminExpiringOrderDto): number {
  if (typeof row.daysLeft === "number" && Number.isFinite(row.daysLeft)) return row.daysLeft;
  if (typeof row.daysUntilEnd === "number" && Number.isFinite(row.daysUntilEnd)) return row.daysUntilEnd;
  return 0;
}

function formatEndDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function matchesSearch(row: AdminExpiringOrderDto, query: string): boolean {
  const q = query.toLowerCase();
  return (
    row.orderNumber.toLowerCase().includes(q) ||
    getBaseOrderNumber(row.orderNumber).toLowerCase().includes(q) ||
    row.listingTitle.toLowerCase().includes(q) ||
    row.customerName.toLowerCase().includes(q) ||
    row.vendorName.toLowerCase().includes(q)
  );
}

const AdminExpirations = () => {
  const navigate = useNavigate();
  const [withinDays, setWithinDays] = useState(7);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-order-expirations", withinDays],
    queryFn: () => adminApi.getAdminOrderExpirations(withinDays),
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, withinDays]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => matchesSearch(row, q));
  }, [rows, debouncedSearch]);

  const groups = useMemo(() => {
    const next: { baseOrderNumber: string; items: AdminExpiringOrderDto[] }[] = [];
    filteredRows.forEach((row) => {
      const baseNum = getBaseOrderNumber(row.orderNumber);
      let group = next.find((g) => g.baseOrderNumber === baseNum);
      if (!group) {
        group = { baseOrderNumber: baseNum, items: [] };
        next.push(group);
      }
      group.items.push(row);
    });
    return next;
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = useMemo(
    () => groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [groups, safePage],
  );

  const itemCount = filteredRows.length;
  const groupCount = groups.length;
  const hasSearch = debouncedSearch.length > 0;

  return (
    <div>
      <PageHeader
        title="Expirations"
        description="Delivered rentals due for return across all vendors."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant={withinDays === 7 ? "default" : "outline"} onClick={() => setWithinDays(7)}>7 days</Button>
            <Button variant={withinDays === 15 ? "default" : "outline"} onClick={() => setWithinDays(15)}>15 days</Button>
            <Button variant={withinDays === 30 ? "default" : "outline"} onClick={() => setWithinDays(30)}>30 days</Button>
          </div>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 max-w-2xl">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by order ID, item, customer, or vendor"
              className="h-11 rounded-xl pl-9"
              aria-label="Search expirations"
            />
          </div>
        </div>

        {isLoading ? (
          <PageLoaderSlot />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No expiring orders in selected window.</p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No expirations match “{debouncedSearch}”.
          </p>
        ) : (
          <div className="space-y-6">
            {pageGroups.map((group) => (
              <div key={group.baseOrderNumber} className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border/100 sm:p-6">
                <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Group</div>
                    <div className="mt-0.5 break-all text-base font-bold text-foreground">{group.baseOrderNumber}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {group.items.map((row) => (
                    <div
                      key={row.orderId}
                      className="cursor-pointer rounded-lg border border-border p-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/50 sm:p-4"
                      onClick={() => navigate(`/admin/orders/${row.orderId}`)}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground break-words">{row.listingTitle}</p>
                          <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-1">
                            <span>Order <strong className="font-medium text-foreground">{row.orderNumber}</strong> ({row.orderType.toUpperCase()})</span>
                            <span className="hidden text-muted-foreground/30 sm:inline" aria-hidden="true">•</span>
                            <span>Vendor <strong className="font-medium text-foreground">{row.vendorName}</strong></span>
                            <span className="hidden text-muted-foreground/30 sm:inline" aria-hidden="true">•</span>
                            <span>Customer <strong className="font-medium text-foreground">{row.customerName}</strong></span>
                            <span className="hidden text-muted-foreground/30 sm:inline" aria-hidden="true">•</span>
                            <span>Ends on <strong className="font-medium text-foreground">{formatEndDate(row.endDate)}</strong></span>
                          </div>
                        </div>
                        <Badge className="mt-1 w-fit shrink-0 sm:mt-0" variant={resolveDaysLeft(row) <= 1 ? "destructive" : "secondary"}>
                          {(() => {
                            const days = resolveDaysLeft(row);
                            if (days <= 0) return "Due Today";
                            if (days === 1) return "1 day left";
                            return `${days} days left`;
                          })()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {safePage} of {totalPages} · {groupCount} order{groupCount !== 1 ? "s" : ""} · {itemCount} item{itemCount !== 1 ? "s" : ""}
                {hasSearch ? " matching search" : ""}
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

export default AdminExpirations;
