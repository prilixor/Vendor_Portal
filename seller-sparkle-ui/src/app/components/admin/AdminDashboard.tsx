import { useState, useEffect } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { StatCard } from "@/app/components/shared/StatCard";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { adminApi, AdminAuditLogDto, VendorDto } from "@/app/services/adminApi";
import { Building2, Clock, CheckCircle2, ScrollText, ArrowUpRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDto[]>([]);
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, vendorsData] = await Promise.all([
        adminApi.getAuditLogs().catch(() => []),
        adminApi.getVendors().catch(() => []),
      ]);
      setAuditLogs(logsData);
      setVendors(vendorsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load data.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const total = vendors.length;
  const pending = vendors.filter(v => v.accountStatus === "pending").length;
  const active = vendors.filter(v => v.accountStatus === "active").length;

  // Filter audit logs for last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentAuditLogs = auditLogs.filter(log => {
    const logDate = new Date(log.createdAt);
    return logDate >= sevenDaysAgo;
  });

  return (
    <div>
      <PageHeader title="Admin overview" description="Monitor platform health, vendor verification queue, and recent activity." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total vendors" value={total} icon={Building2} accent="primary"  />
        <StatCard label="Pending verifications" value={pending} icon={Clock} accent="warning" />
        <StatCard label="Active vendors" value={active} icon={CheckCircle2} accent="success" />
        <StatCard label="Audit events (7d)" value={recentAuditLogs.length} icon={ScrollText} accent="info" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-semibold">Verification queue</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/verification")}>
              Open queue <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {vendors.filter(v => v.accountStatus === "pending").slice(0, 5).map((vendor) => (
                <li key={vendor.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vendor.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {vendor.registrationStage} · {vendor.emailVerified ? "Email verified" : "Email not verified"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/vendors/${vendor.id}`)}
                    >
                      Review
                    </Button>
                  </div>
                </li>
              ))}
              {vendors.filter(v => v.accountStatus === "pending").length === 0 && (
                <li className="p-8 text-center text-muted-foreground text-sm">No pending verifications</li>
              )}
            </ul>
          )}
        </Card>

        <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
          <div className="border-b border-border pb-4">
            <h2 className="font-semibold">Recent audit events (Last 7 days)</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentAuditLogs.slice(0, 5).map((log) => (
                <li key={log.id} className="p-3">
                  <p className="text-xs font-mono font-semibold text-primary">{log.actionType}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {log.adminName || log.adminEmail || log.adminId} · {log.entityType}
                  </p>
                </li>
              ))}
              {recentAuditLogs.length === 0 && (
                <li className="p-8 text-center text-muted-foreground text-sm">No recent audit events</li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;


