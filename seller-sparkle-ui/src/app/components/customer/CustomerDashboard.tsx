import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Package, Truck, LifeBuoy, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { customerApi, type CustomerCatalogListingApi, type CustomerOrderApi } from "@/app/services/customerApi";

function currencyInr(n: number): string {
  return `₹${n.toFixed(0)}`;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function StatCard({ label, value, hint, to }: { label: string; value: number; hint: string; to?: string }) {
  const content = (
    <Card className={to ? "transition-colors hover:bg-muted/50" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Badge variant="secondary" className="text-[10px]">
            Live
          </Badge>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block hover:no-underline">
        {content}
      </Link>
    );
  }
  return content;
}

const CustomerDashboard = () => {
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Customer";

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => customerApi.getOrders(),
  });
  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["customer-catalog-stock-dashboard"],
    queryFn: () => customerApi.getCatalogListings(),
  });

  const list = orders ?? [];
  const activeRentals = list.filter((o) => norm(o.status) === "active").length;
  const activeTotal = list.filter((o) => norm(o.status) === "active").reduce((s, o) => s + o.totalAmount, 0);
  const upcomingDeliveries = list.filter((o) => {
    const n = norm(o.status);
    return n === "confirmed" || n === "in transit" || n === "pending";
  }).length;

  const activityRows = buildActivityRows(list);
  const inStockListings = countListingsByAvailability(catalog, (s) => s === "available" || s === "low_stock");
  const outOfStockListings = countListingsByAvailability(catalog, (s) => s === "out_of_stock");

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {displayName} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Here&apos;s a snapshot of your rentals and account activity.</p>
          </div>
          <Button asChild className="bg-gradient-primary hover:opacity-95 shadow-glow shrink-0">
            <Link to="/customer/shop">
              Browse listings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load orders."}</p>
      )}

      {isLoading || catalogLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard 
            label="Active rentals" 
            value={activeRentals} 
            hint={`${currencyInr(activeTotal)} in flight`} 
            to="/customer/orders?status=Active"
          />
          <StatCard
            label="Upcoming deliveries"
            value={upcomingDeliveries}
            hint="Across pending, confirmed, and in transit"
            to="/customer/orders?status=Confirmed"
          />
          <StatCard
            label="Browse availability"
            value={inStockListings}
            hint={`${outOfStockListings} listings currently out of stock`}
            to="/customer/shop"
          />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link to="/customer/orders" className="text-sm text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 px-6 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activityRows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No recent orders yet.{" "}
              <Link to="/customer/shop" className="font-medium text-primary hover:underline">
                Browse listings
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {activityRows.map((a, i) => {
                const Icon = a.icon;
                return (
                  <li key={i} className="flex items-center gap-3 px-6 py-3 text-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1">{a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.at}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function buildActivityRows(orders: CustomerOrderApi[]): { icon: typeof Package; title: string; at: string }[] {
  const icons = [Truck, Package, Clock, LifeBuoy];
  return orders.slice(0, 5).map((o, i) => ({
    icon: icons[i % icons.length]!,
    title: `${o.status}: ${o.orderNumber} · ${o.listingTitle}`,
    at: "Recently",
  }));
}

function countListingsByAvailability(
  rows: CustomerCatalogListingApi[],
  predicate: (status: string) => boolean,
): number {
  return rows.reduce((count, row) => {
    const status = row.availabilityStatus.trim().toLowerCase();
    return count + (predicate(status) ? 1 : 0);
  }, 0);
}

export default CustomerDashboard;
