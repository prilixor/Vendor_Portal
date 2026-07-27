import { useEffect, useMemo, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatCard } from "@/app/components/shared/StatCard";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Button } from "@/app/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { toCamelCase } from "@/app/helpers/utils";
import { Package, CheckCircle2, Boxes, Bell, Plus, ArrowUpRight, Clock, Sparkles, ClipboardList, Truck, TimerReset, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import type { VerificationStatus } from "@/app/models";
import { getVendorRoute } from "@/app/helpers/vendorNav";
import { notificationDisplayMessage } from "@/app/helpers/adminComment";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";

type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  notificationType?: string;
};

type TopListingRow = {
  id: string;
  title: string;
  category: string;
  weeklyRent: number;
  monthlyRent: number;
  stock: number;
  status: VerificationStatus;
};

const normalizeListingStatus = (status: string): VerificationStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved" || normalized === "active") return "approved";
  if (normalized === "rejected" || normalized === "blocked") return "rejected";
  if (normalized === "under_review" || normalized === "submitted") return "under_review";
  return "pending";
};

const normalizeVerificationStatus = (status: string): VerificationStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "under_review") return "under_review";
  return "pending";
};

const mapNotificationType = (type: string): DashboardNotification["type"] => {
  const t = type.trim().toLowerCase();
  if (t === "success" || t.includes("approved")) return "success";
  if (t === "error" || t.includes("rejected") || t.includes("failed")) return "error";
  if (t === "warning" || t.includes("warning") || t.includes("stock")) return "warning";
  return "info";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ownerName, setOwnerName] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("Complete your onboarding verifications.");
  const { operationsBlocked, isLoading: statusLoading } = useVendorVerification();
  const isPending = operationsBlocked || statusLoading;

  const [totalListings, setTotalListings] = useState(0);
  const [activeListings, setActiveListings] = useState(0);
  const [inventoryUnits, setInventoryUnits] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [confirmedOrdersCount, setConfirmedOrdersCount] = useState(0);
  const [inTransitOrdersCount, setInTransitOrdersCount] = useState(0);
  const [dueReturnsCount, setDueReturnsCount] = useState(0);

  const [recentActivity, setRecentActivity] = useState<DashboardNotification[]>([]);
  const [topListings, setTopListings] = useState<TopListingRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      try {
        const [profileRes, docsRes, banksRes, listingsRes, notificationsRes, productsRes, categoriesRes, offersRes, confirmedRes, inTransitRes, expirationsRes] = await Promise.allSettled([
          vendorOnboardingApi.getVendorProfile(user.id),
          vendorOnboardingApi.getVendorDocuments(user.id),
          vendorOnboardingApi.getVendorBankAccounts(user.id),
          vendorOnboardingApi.getVendorProductListings(user.id),
          vendorOnboardingApi.getVendorNotifications(user.id),
          vendorOnboardingApi.getProducts(),
          vendorOnboardingApi.getProductCategories(),
          vendorOnboardingApi.getVendorDispatchOffers(user.id),
          vendorOnboardingApi.getVendorOrders(user.id, "confirmed"),
          vendorOnboardingApi.getVendorOrders(user.id, "in_transit"),
          vendorOnboardingApi.getVendorOrderExpirations(user.id, 7),
        ]);

        if (profileRes.status === "fulfilled") {
          setOwnerName(profileRes.value.ownerName || user.name);
          setBusinessName(profileRes.value.businessName || user.name);
        } else {
          setOwnerName(user.name);
          setBusinessName(user.name);
        }

        const docs = docsRes.status === "fulfilled" ? docsRes.value : [];
        const banks = banksRes.status === "fulfilled" ? banksRes.value : [];
        const listings = listingsRes.status === "fulfilled" ? listingsRes.value : [];
        const notifications = notificationsRes.status === "fulfilled" ? notificationsRes.value : [];
        const products = productsRes.status === "fulfilled" ? productsRes.value : [];
        const categories = categoriesRes.status === "fulfilled" ? categoriesRes.value : [];

        const approvedDocs = docs.filter((d) => normalizeVerificationStatus(d.verificationStatus) === "approved").length;
        const rejectedDocs = docs.filter((d) => normalizeVerificationStatus(d.verificationStatus) === "rejected").length;
        const approvedBanks = banks.filter((b) => normalizeVerificationStatus(b.verificationStatus) === "approved").length;
        const rejectedBanks = banks.filter((b) => normalizeVerificationStatus(b.verificationStatus) === "rejected").length;

        const verified = docs.length > 0 && approvedDocs === docs.length && approvedBanks > 0;
        setIsVerified(verified);
        if (verified) {
          setVerificationMessage("All documents and bank details have been approved.");
        } else if (rejectedDocs > 0 || rejectedBanks > 0) {
          setVerificationMessage("Some verifications were rejected. Please review and resubmit from onboarding.");
        } else {
          setVerificationMessage(`Approved documents: ${approvedDocs}/${docs.length}. Approved bank accounts: ${approvedBanks}/${banks.length}.`);
        }

        const active = listings.filter((l) => normalizeListingStatus(l.listingStatus) === "approved").length;
        setTotalListings(listings.length);
        setActiveListings(active);

        const mappedNotifications = notifications
          .map<DashboardNotification>((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            timestamp: n.sentAt ?? n.readAt ?? new Date().toISOString(),
            type: mapNotificationType(n.notificationType),
            read: n.status.trim().toLowerCase() === "read" || !!n.readAt,
            notificationType: n.notificationType,
          }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setUnreadNotifications(mappedNotifications.filter((n) => !n.read).length);
        setRecentActivity(mappedNotifications.slice(0, 5));

        setPendingRequestsCount(offersRes.status === "fulfilled" ? offersRes.value.length : 0);
        setConfirmedOrdersCount(confirmedRes.status === "fulfilled" ? confirmedRes.value.length : 0);
        setInTransitOrdersCount(inTransitRes.status === "fulfilled" ? inTransitRes.value.length : 0);
        setDueReturnsCount(expirationsRes.status === "fulfilled" ? expirationsRes.value.length : 0);

        const inventoryResponses = await Promise.allSettled(
          listings.map((l) => vendorOnboardingApi.getVendorInventory(user.id, l.id))
        );
        const inventorySum = inventoryResponses.reduce((sum, r, idx) => {
          if (r.status === "fulfilled") {
            return sum + r.value.totalQuantity;
          }
          return sum + listings[idx].availableQuantity;
        }, 0);
        setInventoryUnits(inventorySum);

        const productsById = new Map(products.map((p) => [p.id, p]));
        const categoriesById = new Map(categories.map((c) => [c.id, c.categoryName]));

        const top = listings
          .map<TopListingRow>((l) => {
            const product = productsById.get(l.productId);
            const categoryName = product ? (categoriesById.get(product.categoryId) ?? "N/A") : "N/A";
            return {
              id: l.id,
              title: l.listingTitle,
              category: categoryName,
              weeklyRent: product?.weeklyRent ?? l.weeklyRent ?? 0,
              monthlyRent: product?.monthlyRent ?? l.monthlyRent ?? 0,
              stock: l.availableQuantity,
              status: normalizeListingStatus(l.listingStatus),
            };
          })
          .sort((a, b) => b.stock - a.stock)
          .slice(0, 4);

        setTopListings(top);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load dashboard.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  const greetingName = useMemo(() => toCamelCase(businessName || user?.name || "Vendor"), [businessName, user?.name]);

  // Show skeleton loading state while data is loading
  if (loading || statusLoading) {
    return (
      <div className="min-h-[60vh] p-6">
        {/* Header Skeleton */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>

        {/* Verification Banner Skeleton */}
        <Card className="mb-6 overflow-hidden border-border/60 p-4 sm:p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </Card>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Main Content Grid Skeleton */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Activity Skeleton */}
          <Card className="lg:col-span-2 p-4 sm:p-6 lg:p-8">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <Skeleton className="mt-1 h-2 w-2 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions Skeleton */}
          <Card className="p-4 sm:p-6 lg:p-8">
            <Skeleton className="mb-4 h-5 w-28" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </Card>
        </div>

        {/* Top Listings Table Skeleton */}
        <Card className="mt-6 p-4 sm:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-24" /></th>
                  <th className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></th>
                  <th className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${greetingName}`}
        description={isPending ? "Your account is pending approval. Explore the platform while we review your application." : "Here's what's happening with your rentals today."}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/vendor/inventory")}>View inventory</Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button 
                      onClick={() => navigate("/vendor/products")} 
                      className="bg-gradient-primary shadow-glow"
                      disabled={isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Add listing
                    </Button>
                  </span>
                </TooltipTrigger>
                {isPending && (
                  <TooltipContent side="bottom">
                    <p>Available once your account is approved</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </>
        }
      />

      {/* Verification banner */}
      <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-soft">
        <div className="flex flex-col items-start gap-4 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{isVerified ? "Your account is verified" : "Verification in progress"}</p>
              <p className="text-sm text-muted-foreground">{verificationMessage}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/vendor/onboarding")}>
            Manage profile
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          label="Total listings" 
          value={loading ? "..." : totalListings} 
          icon={Package} 
          accent="primary" 
          onClick={() => navigate("/vendor/products")}
        />
        <StatCard 
          label="Active listings" 
          value={loading ? "..." : activeListings} 
          icon={CheckCircle2} 
          accent="success" 
          onClick={() => navigate("/vendor/products?status=active")}
        />
        <StatCard 
          label="Inventory units" 
          value={loading ? "..." : inventoryUnits} 
          icon={Boxes} 
          accent="info" 
          onClick={() => navigate("/vendor/inventory")}
        />
        <StatCard 
          label="Notifications" 
          value={loading ? "..." : unreadNotifications} 
          icon={Bell} 
          accent="warning" 
          onClick={() => navigate("/vendor/notifications")}
        />
      </div>

      {/* Order operations snapshot */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending requests"
          value={loading ? "..." : pendingRequestsCount}
          icon={ClipboardList}
          accent="warning"
          onClick={() => navigate("/vendor/order-requests")}
        />
        <StatCard
          label="Confirmed orders"
          value={loading ? "..." : confirmedOrdersCount}
          icon={ShoppingBag}
          accent="primary"
          onClick={() => navigate("/vendor/orders?status=confirmed")}
        />
        <StatCard
          label="In transit"
          value={loading ? "..." : inTransitOrdersCount}
          icon={Truck}
          accent="info"
          onClick={() => navigate("/vendor/orders?status=in_transit")}
        />
        <StatCard
          label="Due in 7 days"
          value={loading ? "..." : dueReturnsCount}
          icon={TimerReset}
          accent="success"
          onClick={() => navigate("/vendor/expirations")}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2 p-4 sm:p-6 lg:p-8 border-border/60">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/notifications")}>
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {recentActivity.map((n) => (
              <li
                key={n.id}
                className="flex cursor-pointer items-start gap-3 py-3 transition-colors hover:bg-muted/30 rounded px-2 -mx-2"
                onClick={() => {
                  const route = getVendorRoute(n.notificationType, n.title);
                  if (route) {
                    navigate(route);
                  }
                }}
              >
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  n.type === "success" ? "bg-success" :
                  n.type === "warning" ? "bg-warning" :
                  n.type === "error" ? "bg-destructive" : "bg-info"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {notificationDisplayMessage(n.message, n.notificationType ?? "")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(n.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
            {recentActivity.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">No recent activity yet.</li>
            )}
          </ul>
        </Card>

        {/* Quick actions */}
        <Card className="p-4 sm:p-6 lg:p-8 border-border/60">
          <h2 className="mb-4 font-semibold">Quick actions</h2>
          <div className="space-y-2">
            {[
              { label: "Add new product", to: "/vendor/products" },
              //{ label: "Update working hours", to: "/vendor/working-hours" },
              { label: "Add service area", to: "/vendor/service-areas" },
              { label: "Review order requests", to: "/vendor/order-requests" },
              { label: "Manage live orders", to: "/vendor/orders" },
              { label: "Review documents", to: "/vendor/onboarding" },
              { label: "Notification preferences", to: "/vendor/notifications" },
            ].map((a) => (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition-all hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
              >
                {a.label}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Top listings */}
      <Card className="mt-6 p-4 sm:p-6 lg:p-8 border-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Top listings</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/products")}>View all</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Rent</th>
                <th className="px-4 py-3 font-semibold text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topListings.map((p) => (
                <tr key={p.id} className="align-middle">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono tabular-nums text-sm">₹{p.weeklyRent}<span className="text-muted-foreground">/w</span></div>
                    <div className="font-mono tabular-nums text-xs text-muted-foreground">₹{p.monthlyRent}/mo</div>
                  </td>
                  <td className="px-4 py-3 text-right">{p.stock}</td>
                </tr>
              ))}
              {topListings.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={4}>
                    No listings available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;


