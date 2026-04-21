import { Card } from "@/app/components/ui/card";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatCard } from "@/app/components/shared/StatCard";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Button } from "@/app/components/ui/button";
import { mockNotifications, mockProducts } from "@/app/services/mockData";
import { Package, CheckCircle2, Boxes, Bell, Plus, ArrowUpRight, Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const active = mockProducts.filter((p) => p.status === "active").length;
  const totalQty = mockProducts.reduce((s, p) => s + p.quantity, 0);
  const unread = mockNotifications.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Welcome back, Priya 👋"
        description="Here's what's happening with your rentals today."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/vendor/inventory")}>View inventory</Button>
            <Button onClick={() => navigate("/vendor/products")} className="bg-gradient-primary shadow-glow">
              <Plus className="mr-2 h-4 w-4" /> Add listing
            </Button>
          </>
        }
      />

      {/* Verification banner */}
      <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-soft">
        <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Your account is verified</p>
              <p className="text-sm text-muted-foreground">All documents and bank details have been approved.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/vendor/onboarding")}>
            Manage profile
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total listings" value={mockProducts.length} icon={Package} accent="primary" trend={{ value: "12% this month", positive: true }} />
        <StatCard label="Active listings" value={active} icon={CheckCircle2} accent="success" trend={{ value: "2 new", positive: true }} />
        <StatCard label="Inventory units" value={totalQty} icon={Boxes} accent="info" />
        <StatCard label="Notifications" value={unread} icon={Bell} accent="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2 p-5 border-border/60">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/notifications")}>
              View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {mockNotifications.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  n.type === "success" ? "bg-success" :
                  n.type === "warning" ? "bg-warning" :
                  n.type === "error" ? "bg-destructive" : "bg-info"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(n.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Quick actions */}
        <Card className="p-5 border-border/60">
          <h2 className="mb-4 font-semibold">Quick actions</h2>
          <div className="space-y-2">
            {[
              { label: "Add new product", to: "/vendor/products" },
              { label: "Update working hours", to: "/vendor/working-hours" },
              { label: "Add service area", to: "/vendor/service-areas" },
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
      <Card className="mt-6 p-5 border-border/60">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Top listings</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/vendor/products")}>View all</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 font-semibold">Product</th>
                <th className="py-2 font-semibold">Category</th>
                <th className="py-2 font-semibold text-right">Daily</th>
                <th className="py-2 font-semibold text-right">Stock</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockProducts.slice(0, 4).map((p) => (
                <tr key={p.id}>
                  <td className="py-3 font-medium">{p.title}</td>
                  <td className="py-3 text-muted-foreground">{p.category}</td>
                  <td className="py-3 text-right font-mono">₹{p.dailyRent}</td>
                  <td className="py-3 text-right">{p.quantity}</td>
                  <td className="py-3">
                    <StatusBadge status={p.status === "active" ? "approved" : "pending"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;


