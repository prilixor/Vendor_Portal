import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminOrderDto } from "@/app/services/adminApi";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import {
  Search,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  AlertCircle,
  Truck,
  User,
  Building,
  Calendar,
  DollarSign,
  ChevronRight,
  Check,
  Package,
} from "lucide-react";
import { cn } from "@/app/helpers/utils";

const PAGE_SIZE = 8;

const statusTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in_transit", label: "In Transit" },
  { id: "active", label: "Active" },
  { id: "returned", label: "Returned" },
  { id: "cancelled", label: "Cancelled" },
  { id: "dispatch_failed", label: "Dispatch Failed" },
] as const;

function matchesAdminStatus(status: string, tabId: (typeof statusTabs)[number]["id"]): boolean {
  if (tabId === "all") return true;
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (tabId === "pending") return s === "pending" || s === "awaiting vendor acceptance";
  if (tabId === "in_transit") return s.includes("transit");
  if (tabId === "dispatch_failed") return s === "dispatch failed";
  if (tabId === "cancelled") return s === "cancelled" || s === "canceled";
  return s === tabId.replace(/_/g, " ");
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending" || s.includes("awaiting")) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (s === "confirmed") {
    return "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  }
  if (s.includes("transit")) {
    return "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
  }
  if (s === "active") {
    return "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white";
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

const getTimelineSteps = (orderType?: string) => {
  const isBuy = orderType?.toLowerCase() === "buy";
  if (isBuy) {
    return [
      { key: "placed", label: "Order Placed" },
      { key: "confirmed", label: "Vendor Confirmed" },
      { key: "out", label: "Out for Delivery" },
      { key: "active", label: "Delivered & Purchased" },
    ];
  }
  return [
    { key: "placed", label: "Order Placed" },
    { key: "confirmed", label: "Vendor Confirmed" },
    { key: "out", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
    { key: "active", label: "Rental Active" },
    { key: "returned", label: "Returned" },
  ];
};

function getTimelineProgress(status: string, orderType?: string): {
  cancelled: boolean;
  completedThrough: number;
  currentIndex: number | null;
} {
  const raw = status.toLowerCase().trim();
  const compact = raw.replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";

  if (compact === "cancelled" || compact === "canceled") {
    return { cancelled: true, completedThrough: -1, currentIndex: null };
  }
  if (compact === "dispatch_failed" || raw.includes("dispatch failed")) {
    return { cancelled: false, completedThrough: 0, currentIndex: null };
  }
  if (compact === "pending" || compact.includes("awaiting")) {
    return { cancelled: false, completedThrough: 0, currentIndex: 1 };
  }
  if (compact === "confirmed") {
    return { cancelled: false, completedThrough: 1, currentIndex: 2 };
  }
  if (compact === "in_transit" || raw.includes("transit")) {
    return { cancelled: false, completedThrough: 2, currentIndex: 3 };
  }
  if (compact === "active") {
    return isBuy
      ? { cancelled: false, completedThrough: 3, currentIndex: null }
      : { cancelled: false, completedThrough: 3, currentIndex: 4 };
  }
  if (compact === "returned") {
    return { cancelled: false, completedThrough: 5, currentIndex: null };
  }
  return { cancelled: false, completedThrough: 0, currentIndex: 1 };
}

function getAvailableStatuses(currentStatus: string, orderType?: string): string[] {
  const s = currentStatus.toLowerCase().trim().replace(/\s+/g, "_");
  const isBuy = orderType?.toLowerCase() === "buy";
  
  if (s === "pending" || s.includes("awaiting")) {
    return ["pending", "confirmed", "cancelled"];
  }
  if (s === "confirmed") {
    return ["confirmed", "in_transit", "cancelled", "dispatch_failed"];
  }
  if (s === "in_transit" || s.includes("transit")) {
    return ["in_transit", "active", "dispatch_failed", "returned"];
  }
  if (s === "active") {
    return isBuy ? ["active"] : ["active", "returned"];
  }
  if (s === "returned") {
    return ["returned"];
  }
  if (s === "cancelled" || s === "canceled") {
    return ["cancelled"];
  }
  if (s === "dispatch_failed" || s.includes("dispatch failed")) {
    return ["dispatch_failed", "cancelled"];
  }
  return ["pending", "confirmed", "in_transit", "active", "returned", "cancelled", "dispatch_failed"];
}

export const AdminOrders = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as (typeof statusTabs)[number]["id"];
  const isValidTab = statusTabs.some(t => t.id === urlTab);
  
  const [activeTab, setActiveTab] = useState<(typeof statusTabs)[number]["id"]>(
    isValidTab ? urlTab : "all"
  );

  useEffect(() => {
    if (urlTab && isValidTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDto | null>(null);
  const [statusUpdateLocal, setStatusUpdateLocal] = useState<string>("");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (selectedOrder) {
      setStatusUpdateLocal(selectedOrder.status);
    }
  }, [selectedOrder]);

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      adminApi.updateAdminOrderStatus({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
        status: newStatus,
      }),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder(updatedOrder);
      setStatusUpdateLocal(updatedOrder.status);
    },
    onError: (error) => {
      console.error("Failed to update status", error);
      toast.error(getUserFriendlyMessage(error) || "Failed to update status");
    },
  });

  const reassignMutation = useMutation({
    mutationFn: () =>
      adminApi.reassignVendorOrder({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
      }),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder(updatedOrder);
      setStatusUpdateLocal(updatedOrder.status);
    },
    onError: (error) => {
      console.error("Failed to reassign order", error);
      toast.error(getUserFriendlyMessage(error) || "Failed to reassign order");
    },
  });

  const cancelRefundMutation = useMutation({
    mutationFn: () =>
      adminApi.forceCancelRefundOrder({
        adminUserId: user?.id || "",
        orderId: selectedOrder?.orderId || "",
      }),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedOrder(updatedOrder);
      setStatusUpdateLocal(updatedOrder.status);
    },
    onError: (error) => {
      console.error("Failed to force cancel and refund", error);
      toast.error(getUserFriendlyMessage(error) || "Failed to force cancel and refund");
    },
  });

  const { data: orders = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders(),
  });

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  // Statistics Computations
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const revenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const active = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s === "active";
    }).length;
    const returned = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s === "returned";
    }).length;
    const failed = orders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s.includes("dispatch failed");
    }).length;

    return { totalCount, revenue, active, returned, failed };
  }, [orders]);

  // Filtering Logic
  const filtered = useMemo(() => {
    let list = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.vendorName.toLowerCase().includes(q) ||
          o.orderId.toLowerCase().includes(q)
      );
    }
    return list.filter((o) => matchesAdminStatus(o.status, activeTab));
  }, [orders, debouncedSearch, activeTab]);

  const statusCounts = useMemo(() => {
    let searchable = orders;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      searchable = searchable.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.listingTitle.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.vendorName.toLowerCase().includes(q) ||
          o.orderId.toLowerCase().includes(q)
      );
    }
    return statusTabs.reduce<Record<(typeof statusTabs)[number]["id"], number>>((acc, tab) => {
      acc[tab.id] = tab.id === "all" ? searchable.length : searchable.filter((o) => matchesAdminStatus(o.status, tab.id)).length;
      return acc;
    }, {} as Record<(typeof statusTabs)[number]["id"], number>);
  }, [orders, debouncedSearch]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  // Grouping by Base Order Number
  const groupedOrders = useMemo(() => {
    const groups: Array<{
      baseOrderNumber: string;
      items: AdminOrderDto[];
      date: string;
      customerName: string;
      customerEmail: string;
      totalAmount: number;
    }> = [];

    pageSlice.forEach((order) => {
      const baseNum = order.orderNumber.split("-").slice(0, 3).join("-");
      let g = groups.find((x) => x.baseOrderNumber === baseNum);
      if (!g) {
        g = {
          baseOrderNumber: baseNum,
          items: [],
          date: order.createdOnUtc,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          totalAmount: 0,
        };
        groups.push(g);
      }
      g.items.push(order);
      g.totalAmount += order.totalAmount;
    });

    return groups;
  }, [pageSlice]);

  const timelineInfo = useMemo(() => {
    if (!selectedOrder) return null;
    return getTimelineProgress(selectedOrder.status, selectedOrder.orderType);
  }, [selectedOrder]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Orders Tracking"
        description="Comprehensive dashboard to check status transitions, split orders, and vendor fulfillment statistics."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching || isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Items Ordered</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{stats.totalCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-emerald-500/10 text-emerald-500 p-2.5">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Revenue</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">₹{stats.revenue.toFixed(0)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-indigo-500/10 text-indigo-500 p-2.5">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Rentals</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{stats.active}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-slate-500/10 text-slate-500 p-2.5">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Rentals</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{stats.returned}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-destructive/10 text-destructive p-2.5">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dispatch Failed</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-destructive">{stats.failed}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Filter & List Container */}
      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="relative max-w-2xl mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order prefix, item, customer, or vendor..."
            className="pl-9"
            aria-label="Search orders"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-6 h-auto w-full flex-wrap justify-start bg-muted/40 p-1">
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                {tab.label} ({statusCounts[tab.id] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-border/80 bg-accent/10 p-6 space-y-3">
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : groupedOrders.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No customer orders found matching current criteria.</p>
        ) : (
          <div className="space-y-4">
            {groupedOrders.map((group) => (
              <div key={group.baseOrderNumber} className="rounded-xl border border-border/80 bg-card p-6 shadow-sm hover:border-border/100 transition-all">
                {/* Transaction Group Header */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-4 mb-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Group</span>
                    <h4 className="text-base font-bold text-foreground">{group.baseOrderNumber}</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground md:flex md:gap-6">
                    <p>Customer: <span className="font-semibold text-foreground truncate block sm:inline">{group.customerName}</span></p>
                    <p>Email: <span className="font-semibold text-foreground break-all sm:break-normal">{group.customerEmail}</span></p>
                    <p>Placed: <span className="font-semibold text-foreground">{new Date(group.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></p>
                    <p>Combined Total: <span className="font-bold text-primary">₹{group.totalAmount.toFixed(0)}</span></p>
                  </div>
                </div>

                {/* Sub items within order group */}
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.orderId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl bg-card border border-border/50 hover:bg-accent/10 hover:border-border transition-all duration-300 shadow-sm gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        {item.primaryImageUrl ? (
                          <img src={item.primaryImageUrl} alt={item.listingTitle} className="h-12 w-12 rounded-lg object-cover border border-border bg-muted shadow-sm" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                            <Package className="h-5 w-5 opacity-60" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.listingTitle}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5 shrink-0 opacity-60" /> {item.vendorName}</span>
                            <span>Qty: <strong className="text-foreground font-medium">{item.quantity}</strong></span>
                            <span>{item.orderType === "rent" ? `${item.rentalDays} days rental` : "Buyout"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0 pt-3 sm:pt-0 border-t border-border/20 sm:border-none w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("text-[10px] font-semibold py-0.5 px-2", orderTypeBadgeClass(item.orderType))} variant="outline">
                            {item.orderType.toUpperCase()}
                          </Badge>
                          <Badge className={cn("text-[10px] font-semibold py-0.5 px-2", orderStatusBadgeClass(item.status))} variant="outline">
                            {item.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-sm text-foreground sm:w-20 sm:text-right">₹{item.totalAmount.toFixed(0)}</span>
                          <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-semibold px-2 hover:bg-accent text-primary transition-colors flex items-center gap-1 group/btn"
                          onClick={() => setSelectedOrder(item)}
                        >
                          View Tracking
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                        </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages} · {filtered.length} order item{filtered.length !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-xs"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl">
          {selectedOrder && (
            <>
              <div className="shrink-0 pt-2">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center justify-between pr-6">
                    <span>Order Tracking: {selectedOrder.orderNumber}</span>
                    <Badge className={cn("text-[10px] font-semibold", orderStatusBadgeClass(selectedOrder.status))} variant="outline">
                      {selectedOrder.status.toUpperCase()}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Tracking and metadata lifecycle overview for the selected item transaction.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-2">
                {/* Meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg bg-accent/25 p-4 border border-border/40 text-xs mt-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-semibold flex items-center gap-1"><User className="h-3.5 w-3.5" /> Customer Name</p>
                    <p className="font-semibold text-foreground">{selectedOrder.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedOrder.customerEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-semibold flex items-center gap-1"><Building className="h-3.5 w-3.5" /> Assigned Vendor</p>
                    <p className="font-semibold text-foreground">{selectedOrder.vendorName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Rental Terms</p>
                    <p className="font-medium text-foreground">{selectedOrder.orderType === "rent" ? `${selectedOrder.rentalDays} days rental` : "Direct Buyout"}</p>
                    {selectedOrder.startDate && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(selectedOrder.startDate).toLocaleDateString()} → {selectedOrder.endDate ? new Date(selectedOrder.endDate).toLocaleDateString() : ""}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-semibold flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Financial Summary</p>
                    <p className="font-bold text-foreground">₹{selectedOrder.totalAmount.toFixed(0)} total</p>
                    <p className="text-[10px] text-muted-foreground">+ ₹{selectedOrder.depositAmount.toFixed(0)} deposit amount</p>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="space-y-3">
                  <h5 className="text-sm font-bold text-foreground">Timeline Lifecycle Log</h5>
                  {timelineInfo?.cancelled ? (
                    <p className="text-sm text-destructive font-semibold">This order item was cancelled.</p>
                  ) : (
                    <ol className="relative border-l border-border ml-3.5 mt-2 space-y-6">
                      {getTimelineSteps(selectedOrder.orderType).map((step, i) => {
                        const isDone = i <= timelineInfo!.completedThrough;
                        const isCurrent = timelineInfo!.currentIndex === i;
                        const isUpcoming = !isDone && !isCurrent;

                        return (
                          <li key={step.key} className="relative pl-6 last:pb-0">
                            <span className={cn(
                              "absolute -left-[11px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold transition-all",
                              isDone && "bg-foreground text-background border-foreground",
                              isCurrent && "bg-background text-foreground border-foreground shadow-sm animate-pulse",
                              isUpcoming && "bg-muted text-muted-foreground border-border"
                            )}>
                              {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                              {isCurrent ? <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden /> : null}
                            </span>
                            <div>
                              <p className={cn("text-xs font-semibold leading-tight", isUpcoming ? "text-muted-foreground" : "text-foreground")}>
                                {step.label}
                              </p>
                              {isCurrent && <span className="text-[10px] text-muted-foreground font-medium">In Progress / Pending Action</span>}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>

                {/* Admin Status Update Action */}
                <div className="space-y-3 pt-4 border-t border-border/40 pb-4">
                  <h5 className="text-sm font-bold text-foreground">Admin Actions</h5>

                  {selectedOrder.status === "dispatch_failed" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="default"
                            className="w-full text-xs shadow-sm h-auto whitespace-normal py-2"
                            disabled={reassignMutation.isPending}
                          >
                            {reassignMutation.isPending ? "Reassigning..." : "Reassign to new Vendor"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[9999]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reassign Order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to reassign this order to a new vendor? The system will automatically locate and dispatch an offer to the next eligible vendor in the area.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => reassignMutation.mutate()}>Reassign</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full text-xs shadow-sm h-auto whitespace-normal py-2"
                            disabled={updateStatusMutation.isPending}
                          >
                            Override to In-Transit
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[9999]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Override Status?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to forcefully override the status of this item to In-Transit? This will bypass standard vendor dispatch workflows.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => updateStatusMutation.mutate("in_transit")}>Override</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="w-full text-xs shadow-sm h-auto whitespace-normal py-2"
                            disabled={cancelRefundMutation.isPending}
                          >
                            {cancelRefundMutation.isPending ? "Cancelling..." : "Force Cancel & Refund"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[9999]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Force Cancel & Refund?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to forcefully cancel this order and issue a full refund to the customer? This action is permanent and cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Order</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => cancelRefundMutation.mutate()}>Force Cancel</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 bg-accent/20 p-4 rounded-lg border border-border/40">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Force Status Update</p>
                      <Select value={statusUpdateLocal} onValueChange={setStatusUpdateLocal}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusTabs
                            .filter(t => t.id !== "all" && getAvailableStatuses(selectedOrder.status, selectedOrder.orderType).includes(t.id))
                            .map(t => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => updateStatusMutation.mutate(statusUpdateLocal)}
                      disabled={!statusUpdateLocal || statusUpdateLocal === selectedOrder.status || updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
