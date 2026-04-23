import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Search, CheckCircle2, XCircle, Building2, Mail, Loader2, MoreVertical, Ban, ShieldAlert, RotateCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { toast } from "sonner";
import { adminApi, VendorDto } from "@/app/services/adminApi";

const getAdminUserId = () => {
  const adminUser = localStorage.getItem("adminUser");
  if (adminUser) {
    try {
      const parsed = JSON.parse(adminUser);
      return parsed.id;
    } catch {
      return null;
    }
  }
  return null;
};

const Verification = () => {
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "under_review" | "approved" | "rejected">("all");
  const [selected, setSelected] = useState<VendorDto | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionType, setActionType] = useState<"reject" | "suspend" | "ban" | "reactivate">("reject");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getVendors();
      setVendors(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load vendors.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = vendors.filter((v) => {
    const m = filter === "all" || v.accountStatus === filter;
    const s = !search || v.email.toLowerCase().includes(search.toLowerCase());
    return m && s;
  });

  const approve = async (id: string) => {
    setVerifying(true);
    try {
      // TODO: Get adminUserId from auth context
      const adminUserId = getAdminUserId() || "";
      await adminApi.approveVendor({ adminUserId, vendorId: id });
      setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, accountStatus: "active" } : v)));
      setSelected(null);
      toast.success("Vendor approved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve vendor.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const reject = async (id: string) => {
    setVerifying(true);
    try {
      // TODO: Get adminUserId from auth context
      const adminUserId = getAdminUserId() || "";
      await adminApi.rejectVendor({ adminUserId, vendorId: id, reason });
      setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, accountStatus: "rejected" } : v)));
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor rejected with reason");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject vendor.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const suspend = async (id: string) => {
    setVerifying(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.suspendVendor({ adminUserId, vendorId: id, reason });
      setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, accountStatus: "suspended" } : v)));
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor suspended successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to suspend vendor.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const ban = async (id: string) => {
    setVerifying(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.banVendor({ adminUserId, vendorId: id, reason });
      setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, accountStatus: "banned" } : v)));
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor banned successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ban vendor.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const reactivate = async (id: string) => {
    setVerifying(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.reactivateVendor({ adminUserId, vendorId: id, reason });
      setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, accountStatus: "active" } : v)));
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor reactivated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reactivate vendor.";
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleAction = () => {
    if (!selectedVendorId) return;
    if (actionType === "reject") {
      reject(selectedVendorId);
    } else if (actionType === "suspend") {
      suspend(selectedVendorId);
    } else if (actionType === "ban") {
      ban(selectedVendorId);
    } else if (actionType === "reactivate") {
      reactivate(selectedVendorId);
    }
  };

  return (
    <div>
      <PageHeader title="Vendor verification" description="Review business profiles, documents, and bank details. Approve or reject with feedback." />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" className="pl-9" />
          </div>
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg p-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="under_review">Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Registration Stage</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-soft text-primary">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <p className="font-medium">{v.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{v.registrationStage}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.accountStatus as "pending" | "approved" | "rejected" | "under_review"} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(v)}>Review</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vendor detail */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vendor details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
              <div className="space-y-5">
              <div className="rounded-xl border border-border bg-gradient-soft p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{selected.email}</h3>
                    <p className="text-sm text-muted-foreground">Registration Stage: {selected.registrationStage}</p>
                  </div>
                  <StatusBadge status={selected.accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selected.email}</p>
                  <p className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> Email Verified: {selected.emailVerified ? "Yes" : "No"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p>For detailed vendor information (documents, bank details, profile), please use the Vendor Details page.</p>
              </div>
            </div>
            </div>
          )}
          <DialogFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={verifying}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setActionType("reject"); setSelectedVendorId(selected?.id || null); setSelected(null); setRejectOpen(true); }}>
                  <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setActionType("suspend"); setSelectedVendorId(selected?.id || null); setSelected(null); setRejectOpen(true); }}>
                  <ShieldAlert className="mr-2 h-4 w-4 text-warning" /> Suspend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setActionType("ban"); setSelectedVendorId(selected?.id || null); setSelected(null); setRejectOpen(true); }}>
                  <Ban className="mr-2 h-4 w-4 text-destructive" /> Ban
                </DropdownMenuItem>
                {(selected?.accountStatus === "suspended" || selected?.accountStatus === "banned") && (
                  <DropdownMenuItem onClick={() => { setActionType("reactivate"); setSelectedVendorId(selected?.id || null); setSelected(null); setRejectOpen(true); }}>
                    <RotateCcw className="mr-2 h-4 w-4 text-success" /> Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => selected && approve(selected.id)} className="bg-success hover:bg-success/90 text-success-foreground" disabled={verifying}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === "reject" ? "Rejection reason" : actionType === "suspend" ? "Suspension reason" : actionType === "ban" ? "Ban reason" : "Reactivate reason"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <div className="space-y-1.5">
            <Label>{actionType === "reject" ? "Why is this vendor being rejected?" : actionType === "suspend" ? "Why is this vendor being suspended?" : actionType === "ban" ? "Why is this vendor being banned?" : "Why is this vendor being reactivated?"}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide clear feedback so the vendor can fix the issue…" rows={5} />
          </div>
          <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={verifying}>Cancel</Button>
            <Button variant={actionType === "reactivate" ? "default" : "destructive"} onClick={handleAction} disabled={verifying}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Verification;
