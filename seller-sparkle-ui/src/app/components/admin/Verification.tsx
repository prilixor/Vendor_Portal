import { useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { mockVendors, mockBankDetails, mockBusinessProfile } from "@/app/services/mockData";
import { Vendor } from "@/app/models";
import { Search, FileText, CheckCircle2, XCircle, Building2, MapPin, Phone, Mail, Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { toast } from "sonner";
import { getVendorDocuments } from "@/app/services/vendorDocuments";

const Verification = () => {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "under_review" | "approved" | "rejected">("all");
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const filtered = vendors.filter((v) => {
    const m = filter === "all" || v.status === filter;
    const s = !search || v.businessName.toLowerCase().includes(search.toLowerCase()) || v.email.toLowerCase().includes(search.toLowerCase());
    return m && s;
  });

  const approve = (id: string) => {
    setVendors((arr) => arr.map((v) => (v.id === id ? { ...v, status: "approved" } : v)));
    setSelected(null);
    toast.success("Vendor approved");
  };
  const reject = () => {
    if (!selected || !reason) { toast.error("Please add a rejection reason"); return; }
    setVendors((arr) => arr.map((v) => (v.id === selected.id ? { ...v, status: "rejected" } : v)));
    setRejectOpen(false);
    setSelected(null);
    setReason("");
    toast.success("Vendor rejected with reason");
  };

  const selectedDocuments = selected ? getVendorDocuments(selected.id) : [];

  const previewDoc = (fileUrl?: string) => {
    if (!fileUrl) {
      toast.info("Preview is available for uploaded files.");
      return;
    }
    const previewUrl = getPreviewUrl(fileUrl);
    const popup = window.open(previewUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }
    if (previewUrl !== fileUrl) {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    }
  };

  return (
    <div>
      <PageHeader title="Vendor verification" description="Review business profiles, documents, and bank details. Approve or reject with feedback." />

      <Card className="border-border/60">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" className="pl-9" />
          </div>
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="under_review">Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">City</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
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
                      <div>
                        <p className="font-medium">{v.businessName}</p>
                        <p className="text-xs text-muted-foreground">{v.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{v.ownerName}</td>
                  <td className="px-4 py-3">{v.city}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.joinedAt}</td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-gradient-soft p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{selected.businessName}</h3>
                    <p className="text-sm text-muted-foreground">{selected.ownerName}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selected.email}</p>
                  <p className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {mockBusinessProfile.phone}</p>
                  <p className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {mockBusinessProfile.addressLine1}, {selected.city}</p>
                  <p className="font-mono text-xs">GST: {mockBusinessProfile.gstNumber}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Documents ({selectedDocuments.length})</h4>
                <div className="space-y-2">
                  {selectedDocuments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{d.type}</p>
                          <p className="text-xs text-muted-foreground">{d.fileName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => previewDoc(d.fileUrl)}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                  ))}
                  {selectedDocuments.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                      No documents uploaded yet.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Bank details</h4>
                <div className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{mockBankDetails.bankName}</p>
                    <StatusBadge status={mockBankDetails.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mockBankDetails.accountHolderName} · ****{mockBankDetails.accountNumber.slice(-4)} · {mockBankDetails.ifscCode}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(true); }}>
              <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
            </Button>
            <Button onClick={() => selected && approve(selected.id)} className="bg-success hover:bg-success/90 text-success-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection reason</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Why is this vendor being rejected?</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Provide clear feedback so the vendor can fix the issue…" rows={5} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Confirm rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const getPreviewUrl = (fileUrl: string): string => {
  if (!fileUrl.startsWith("data:")) return fileUrl;
  try {
    const [meta, data] = fileUrl.split(",");
    if (!meta || !data) return fileUrl;
    const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return fileUrl;
  }
};

export default Verification;


