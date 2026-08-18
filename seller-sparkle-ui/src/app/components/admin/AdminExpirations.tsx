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
              <div key={group.baseOrderNumber} className="overflow-hidden rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-border/100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Group</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{group.baseOrderNumber}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {group.items.map((row) => (
                    <div
                      key={row.orderId}
                      className="rounded-lg border border-border p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors shadow-sm"
                      onClick={() => navigate(`/admin/orders/${row.orderId}`)}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{row.listingTitle}</p>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span>Order <strong className="text-foreground font-medium">{row.orderNumber}</strong> ({row.orderType.toUpperCase()})</span>
                            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                            <span>Vendor <strong className="text-foreground font-medium">{row.vendorName}</strong></span>
                            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                            <span>Customer <strong className="text-foreground font-medium">{row.customerName}</strong></span>
                            <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                            <span>Ends on <strong className="text-foreground font-medium">{formatEndDate(row.endDate)}</strong></span>
                          </div>
                        </div>
                        <Badge className="w-fit mt-1 sm:mt-0" variant={resolveDaysLeft(row) <= 1 ? "destructive" : "secondary"}>
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
