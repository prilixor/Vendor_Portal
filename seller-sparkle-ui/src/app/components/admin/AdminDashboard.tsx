import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatCard } from "@/app/components/shared/StatCard";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { mockAuditLogs, mockVendors } from "@/app/services/mockData";
import { Building2, Clock, CheckCircle2, ScrollText, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const total = mockVendors.length;
  const pending = mockVendors.filter((v) => v.status === "under_review" || v.status === "pending").length;
  const active = mockVendors.filter((v) => v.status === "approved").length;

  return (
    <div>
      <PageHeader title="Admin overview" description="Monitor platform health, vendor verification queue, and recent activity." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total vendors" value={total} icon={Building2} accent="primary" trend={{ value: "+8 this month", positive: true }} />
        <StatCard label="Pending verifications" value={pending} icon={Clock} accent="warning" />
        <StatCard label="Active vendors" value={active} icon={CheckCircle2} accent="success" />
        <StatCard label="Audit events (24h)" value={mockAuditLogs.length} icon={ScrollText} accent="info" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-semibold">Verification queue</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/verification")}>
              Open queue <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {mockVendors.filter((v) => v.status !== "approved").slice(0, 5).map((v) => (
              <li key={v.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-sm">{v.businessName}</p>
                  <p className="text-xs text-muted-foreground">{v.ownerName} · {v.city}</p>
                </div>
                <StatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
          <div className="border-b border-border pb-4">
            <h2 className="font-semibold">Recent audit events</h2>
          </div>
          <ul className="divide-y divide-border">
            {mockAuditLogs.slice(0, 5).map((log) => (
              <li key={log.id} className="p-3">
                <p className="text-xs font-mono font-semibold text-primary">{log.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {log.actor} · {format(new Date(log.timestamp), "MMM d, HH:mm")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;


