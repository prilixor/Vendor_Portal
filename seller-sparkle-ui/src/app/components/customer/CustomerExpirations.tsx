import { useQuery } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";

const CustomerExpirations = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-order-expirations"],
    queryFn: () => customerApi.getOrderExpirations(30),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load expirations."}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Item expirations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upcoming order end dates for the next 30 days.</p>
      </div>

      {!data?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No upcoming expirations in the selected window.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(() => {
            const groups: { baseOrderNumber: string; items: NonNullable<typeof data> }[] = [];

            data.forEach((x) => {
              const baseNum = x.orderNumber.split('-').slice(0, 3).join('-');
              let g = groups.find((g) => g.baseOrderNumber === baseNum);
              if (!g) {
                g = { baseOrderNumber: baseNum, items: [] };
                groups.push(g);
              }
              g.items.push(x);
            });

            return groups.map((group) => (
              <div key={group.baseOrderNumber} className="overflow-hidden rounded-xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:border-border/100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 mb-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Group</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{group.baseOrderNumber}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {group.items.map((x) => (
                    <div key={x.orderId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/10 hover:border-border transition-all duration-300 shadow-sm gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{x.listingTitle}</p>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span>Order <strong className="text-foreground font-medium">{x.orderNumber}</strong> ({x.orderType})</span>
                          <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                          <span>Ends on <strong className="text-foreground font-medium">{new Date(x.endDate).toLocaleDateString()}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-3 sm:pt-0 border-t border-border/20 sm:border-none">
                        <Badge variant={x.daysLeft <= 3 ? "destructive" : "secondary"}>
                          {x.daysLeft} day(s) left
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

export default CustomerExpirations;
