import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { customerApi, type ExpiringOrderApi } from "@/app/services/customerApi";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { cn } from "@/app/helpers/utils";

function formatEndDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getBaseOrderNumber(orderNumber: string): string {
  return orderNumber.split("-").slice(0, 3).join("-");
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Due today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

function urgencyBadgeClass(daysLeft: number): string {
  if (daysLeft <= 0) {
    return "border-0 bg-destructive text-destructive-foreground hover:bg-destructive";
  }
  if (daysLeft <= 3) {
    return "border-0 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200";
  }
  return "border-0 bg-muted text-foreground hover:bg-muted";
}

function endDateClass(daysLeft: number): string {
  if (daysLeft <= 0) return "font-semibold text-destructive";
  if (daysLeft <= 3) return "font-semibold text-amber-700 dark:text-amber-400";
  return "font-medium text-foreground";
}

const PAGE_SIZE = 8;

const CustomerExpirations = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-order-expirations"],
    queryFn: () => customerApi.getOrderExpirations(30),
  });

  const groups = useMemo(() => {
    const next: { baseOrderNumber: string; items: ExpiringOrderApi[] }[] = [];
    (data ?? []).forEach((row) => {
      const baseNum = getBaseOrderNumber(row.orderNumber);
      let group = next.find((g) => g.baseOrderNumber === baseNum);
      if (!group) {
        group = { baseOrderNumber: baseNum, items: [] };
        next.push(group);
      }
      group.items.push(row);
    });
    return next;
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageGroups = useMemo(
    () => groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [groups, safePage],
  );

  if (isLoading) {
    return <PageLoaderSlot />;
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load expirations."}
      </p>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rental expirations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track rental end dates for the next 30 days.</p>
      </div>

      {!data?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No upcoming rental end dates in the selected window.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {pageGroups.map((group) => (
            <div
              key={group.baseOrderNumber}
              className="overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:p-6"
            >
              <div className="mb-3 border-b border-border/60 pb-3 sm:mb-4 sm:pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order group</p>
                <p className="mt-0.5 break-all text-[15px] font-semibold tabular-nums tracking-tight sm:text-base sm:font-bold">
                  {group.baseOrderNumber}
                </p>
              </div>

              <div className="space-y-2 sm:space-y-3">
                {group.items.map((row) => (
                  <div
                    key={row.orderId}
                    className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4"
                  >
                    <div className="min-w-0 w-full sm:flex-1">
                      <Link
                        to={`/customer/orders/${encodeURIComponent(row.orderId)}`}
                        className="block text-sm font-semibold leading-snug text-foreground hover:underline sm:truncate"
                      >
                        {row.listingTitle}
                      </Link>
                      <p className="mt-0.5 break-all text-[11px] leading-snug tabular-nums text-muted-foreground">
                        {row.orderNumber}
                        <span className="whitespace-nowrap uppercase"> · {row.orderType}</span>
                      </p>
                      <p className={cn("mt-1 text-xs tabular-nums", endDateClass(row.daysLeft))}>
                        Ends {formatEndDate(row.endDate)}
                      </p>
                    </div>

                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-3">
                      <Badge className={cn("h-5 whitespace-nowrap px-2 py-0 text-[10px] font-semibold leading-none", urgencyBadgeClass(row.daysLeft))}>
                        {urgencyLabel(row.daysLeft)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="h-7 px-1.5 text-xs font-semibold text-primary sm:h-8 sm:px-2"
                      >
                        <Link to={`/customer/orders/${encodeURIComponent(row.orderId)}`}>
                          Details
                          <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={groups.length}
            onPageChange={setPage}
            label="orders"
          />
        </div>
      )}
    </div>
  );
};

export default CustomerExpirations;
