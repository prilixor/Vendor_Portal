import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorExpiringOrderApiDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";

const VendorExpirations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [withinDays, setWithinDays] = useState(7);
  const [rows, setRows] = useState<VendorExpiringOrderApiDto[]>([]);

  const loadExpirations = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await vendorOnboardingApi.getVendorOrderExpirations(user.id, withinDays);
      setRows(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load expirations.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpirations();
  }, [user?.id, withinDays]);

  const resolveDaysLeft = (row: VendorExpiringOrderApiDto): number => {
    if (typeof row.daysLeft === "number" && Number.isFinite(row.daysLeft)) return row.daysLeft;
    if (typeof row.daysUntilEnd === "number" && Number.isFinite(row.daysUntilEnd)) return row.daysUntilEnd;
    return 0;
  };

  const formatEndDate = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div>
      <PageHeader
        title="Expirations"
        description="Track rentals nearing end date for timely returns and follow-up."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant={withinDays === 7 ? "default" : "outline"} onClick={() => setWithinDays(7)}>7 days</Button>
            <Button variant={withinDays === 15 ? "default" : "outline"} onClick={() => setWithinDays(15)}>15 days</Button>
            <Button variant={withinDays === 30 ? "default" : "outline"} onClick={() => setWithinDays(30)}>30 days</Button>
          </div>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No expiring orders in selected window.</p>
        ) : (
          <div className="space-y-6">
            {(() => {
              const groups: { baseOrderNumber: string; items: VendorExpiringOrderApiDto[] }[] = [];

              rows.forEach((row) => {
                const baseNum = row.orderNumber.split('-').slice(0, 3).join('-');
                let g = groups.find((g) => g.baseOrderNumber === baseNum);
                if (!g) {
                  g = { baseOrderNumber: baseNum, items: [] };
                  groups.push(g);
                }
                g.items.push(row);
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
                    {group.items.map((row) => (
                      <div 
                        key={row.orderId} 
                        className="rounded-lg border border-border p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors shadow-sm"
                        onClick={() => navigate(`/vendor/orders/${row.orderId}`)}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{row.listingTitle}</p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1">
                              <span>Order <strong className="text-foreground font-medium">{row.orderNumber}</strong> ({row.orderType.toUpperCase()})</span>
                              <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                              <span>Customer <strong className="text-foreground font-medium">{row.customerName}</strong></span>
                              <span className="text-muted-foreground/30" aria-hidden="true">•</span>
                              <span>Ends on <strong className="text-foreground font-medium">{formatEndDate(row.endDate)}</strong></span>
                            </div>
                          </div>
                          <Badge className="w-fit mt-1 sm:mt-0" variant={resolveDaysLeft(row) <= 1 ? "destructive" : "secondary"}>
                            {resolveDaysLeft(row) <= 0 ? "Due today" : `${resolveDaysLeft(row)} day(s) left`}
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
      </Card>
    </div>
  );
};

export default VendorExpirations;
