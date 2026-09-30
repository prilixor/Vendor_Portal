import { useEffect, useMemo, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { PageContentGate } from "@/app/components/shared/PageLoader";
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
import { getVendorRoute, VENDOR_SUPPORT_PANEL_ROUTE } from "@/app/helpers/vendorNav";
import { notificationDisplayMessage } from "@/app/helpers/adminComment";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";
import { useSupportChat } from "@/app/contexts/SupportChatContext";
import { LegalPolicyLinks } from "@/app/components/legal/LegalPolicyLinks";

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
  dailyRent: number;
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
  const { openSupportPanel } = useSupportChat();

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      try {
        const summary = await vendorOnboardingApi.getVendorDashboardSummary(user.id);
        setOwnerName(summary.ownerName || user.name);
        setBusinessName(summary.businessName || user.name);
        setIsVerified(summary.isVerified);
        setVerificationMessage(summary.verificationMessage);
        setTotalListings(summary.totalListings);
        setActiveListings(summary.activeListings);
        setInventoryUnits(summary.inventoryUnits);
        setUnreadNotifications(summary.unreadNotifications);
        setPendingRequestsCount(summary.pendingRequestsCount);
        setConfirmedOrdersCount(summary.confirmedOrdersCount);
        setInTransitOrdersCount(summary.inTransitOrdersCount);
        setDueReturnsCount(summary.dueReturnsCount);
        setRecentActivity(
          (summary.recentActivity ?? []).map((n) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            timestamp: n.timestamp,
            type: mapNotificationType(n.notificationType),
            read: n.read,
            notificationType: n.notificationType,
          })),
        );
        setTopListings(
          (summary.topListings ?? []).map((l) => ({
            id: l.id,
            title: l.title,
            category: l.category,
            dailyRent: l.dailyRent,
            stock: l.stock,
            status: normalizeListingStatus(l.status),
          })),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load dashboard.";
        toast.error(message);
        setOwnerName(user.name);
        setBusinessName(user.name);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  const greetingName = useMemo(() => toCamelCase(businessName || user?.name || "Vendor"), [businessName, user?.name]);

  return (
    <PageContentGate loading={loading || statusLoading} className="min-h-[60vh]">
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
                  if (route === VENDOR_SUPPORT_PANEL_ROUTE) {
                    openSupportPanel();
                    return;
                  }
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
                <th className="px-4 py-3 font-semibold text-right">Daily rate</th>
                <th className="px-4 py-3 font-semibold text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topListings.map((p) => (
                <tr key={p.id} className="align-middle">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono tabular-nums text-sm">
                      ₹{p.dailyRent ?? 0}
                      <span className="text-muted-foreground">/day</span>
                    </div>
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

      <Card className="mt-6 border-border/60 p-4 sm:p-6">
        <h2 className="mb-1 font-semibold">Legal</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Agreements for your vendor account.
        </p>
        <LegalPolicyLinks
          surface="vendor_web"
          screen="vendor_dashboard"
          layout="quiet"
          className="max-w-md"
        />
      </Card>
    </div>
    </PageContentGate>
  );
};

export default Dashboard;


