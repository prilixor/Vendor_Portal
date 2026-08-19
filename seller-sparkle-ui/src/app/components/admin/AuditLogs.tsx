import { useState, useEffect } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { adminApi, AdminAuditLogDto, AdminUserDto } from "@/app/services/adminApi";
import { Search, ArrowRight } from "lucide-react";
import { safeFormatDate, safeFormatDistance } from "@/app/utils/dateUtils";
import { toast } from "sonner";

const AuditLogs = () => {
  const [search, setSearch] = useState("");
  const [actor, setActor] = useState<string>("all");
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDto[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const [logsData, adminsData] = await Promise.all([
        adminApi.getAuditLogs(),
        adminApi.getAdminUsers()
      ]);
      setAuditLogs(logsData);
      setAdminUsers(adminsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load audit logs.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const actors = Array.from(new Set([
    ...adminUsers.map(a => a.fullName || a.email),
    ...auditLogs.map((l) => l.adminName || l.adminEmail || l.adminId)
  ]));

  const filtered = auditLogs.filter((l) => {
    const actorName = l.adminName || l.adminEmail || l.adminId;
    const m = actor === "all" || actorName === actor;
    const s = !search || l.actionType.toLowerCase().includes(search.toLowerCase()) || l.entityType.toLowerCase().includes(search.toLowerCase());
    return m && s;
  });

  return (
    <div>
      <PageHeader title="Audit logs" description="Track every important action taken by admins and the system." />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <PageLoaderSlot />
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action or entity…" className="pl-9" />
              </div>
              <Select value={actor} onValueChange={setActor}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actors</SelectItem>
                  {actors.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Entity</th>
                    <th className="px-4 py-3 font-semibold">Actor</th>
                    <th className="px-4 py-3 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3"><span className="rounded-md bg-primary-soft px-2 py-1 text-xs font-mono font-semibold text-primary">{log.actionType}</span></td>
                      <td className="px-4 py-3"><p className="font-medium">{log.entityType}</p></td>
                      <td className="px-4 py-3">{log.adminName || log.adminEmail || log.adminId}</td>
                      <td className="px-4 py-3">
                        <ChangeDisplay log={log} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

const ChangeDisplay = ({ log }: { log: AdminAuditLogDto }) => {
  // Get color based on the actual status value
  const getStatusColor = (value: string | null): string => {
    if (!value) return 'bg-muted text-muted-foreground';
    const v = value.toLowerCase().trim();
    
    // Success/Green states - check if value contains these keywords
    if (v.includes('approved') || v.includes('active') || v.includes('verified') || v.includes('completed') || v.includes('success') || v.includes('create')) {
      return 'bg-success-soft text-success';
    }
    // Error/Destructive/Red states
    if (v.includes('rejected') || v.includes('banned') || v.includes('failed') || v.includes('error') || v.includes('deleted') || v.includes('delete') || v.includes('remove')) {
      return 'bg-destructive-soft text-destructive';
    }
    // Warning/Orange states
    if (v.includes('suspended') || v.includes('under_review') || v.includes('warning') || v.includes('suspend')) {
      return 'bg-warning-soft text-warning';
    }
    // Grey/Muted states
    if (v.includes('pending')) {
      return 'bg-muted text-muted-foreground';
    }
    // Info/Blue states
    if (v.includes('submitted') || v.includes('processing') || v.includes('info') || v.includes('update') || v.includes('edit')) {
      return 'bg-info-soft text-info';
    }
    // Default muted
    return 'bg-muted text-muted-foreground';
  };
  
  return (
    <div className="inline-flex items-center gap-2 text-xs">
      {log.oldValue && <span className={`rounded px-1.5 py-0.5 font-mono ${getStatusColor(log.oldValue)}`}>{log.oldValue}</span>}
      {log.oldValue && log.newValue && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
      {log.newValue && <span className={`rounded px-1.5 py-0.5 font-mono ${getStatusColor(log.newValue)}`}>{log.newValue}</span>}
    </div>
  );
};

export default AuditLogs;
