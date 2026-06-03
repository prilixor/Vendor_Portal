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
        <div className="space-y-3">
          {data.map((x) => (
            <Card key={x.orderId} className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{x.listingTitle}</p>
                  <Badge variant={x.daysLeft <= 3 ? "destructive" : "secondary"}>
                    {x.daysLeft} day(s) left
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Order <span className="font-medium text-foreground">{x.orderNumber}</span> ({x.orderType})
                </p>
                <p>Ends on {new Date(x.endDate).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerExpirations;
