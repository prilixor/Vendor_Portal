import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Search, CheckCircle2, XCircle, Building2, Mail, Loader2, MoreVertical, Ban, ShieldAlert, RotateCcw, FileText, Eye, Building, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { toast } from "sonner";
import { adminApi, VendorDto, VendorProfileDto, VendorDocumentDto, VendorBankAccountDto } from "@/app/services/adminApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

const getApiOrigin = (): string | null => {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!configured) return null;

  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
};

const normalizeHostedFileUrl = (fileUrl: string): string => {
  if (!fileUrl || fileUrl.startsWith("data:")) return fileUrl;

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return fileUrl;

  try {
    // Support both absolute and relative paths and pin uploads to current API host.
    const parsed = new URL(fileUrl, apiOrigin);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return fileUrl;
  }
};

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
  const [itemActionLoadingKey, setItemActionLoadingKey] = useState<string | null>(null);
  const [itemRejectOpen, setItemRejectOpen] = useState(false);
  const [itemRejectNotes, setItemRejectNotes] = useState("");
  const [itemRejectTarget, setItemRejectTarget] = useState<{ kind: "doc" | "bank"; vendorId: string; itemId: string } | null>(null);
  const [documents, setDocuments] = useState<VendorDocumentDto[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<VendorBankAccountDto[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: string } | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfileDto | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Map<string, VendorProfileDto>>(new Map());

  useEffect(() => {
    loadVendors();
  }, []);

  // Load documents when a vendor is selected
  useEffect(() => {
    if (selected) {
      loadDocuments(selected.id);
      loadBankAccounts(selected.id);
      loadVendorProfile(selected.id);
    } else {
      setDocuments([]);
      setBankAccounts([]);
      setVendorProfile(null);
    }
  }, [selected]);

  // Auto-refresh documents every 10 seconds when dialog is open
  useEffect(() => {
    if (!selected) return;

    const interval = setInterval(() => {
      loadDocuments(selected.id);
    }, 10000);

    return () => clearInterval(interval);
  }, [selected]);

  const loadDocuments = async (vendorId: string) => {
    setLoadingDocs(true);
    try {
      const docs = await adminApi.getVendorDocuments(vendorId);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadBankAccounts = async (vendorId: string) => {
    setLoadingBanks(true);
    try {
      const banks = await adminApi.getVendorBankAccounts(vendorId);
      setBankAccounts(banks);
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadVendorProfile = async (vendorId: string) => {
    try {
      const profile = await adminApi.getVendorProfile(vendorId);
      setVendorProfile(profile);
    } catch (error) {
      console.error("Failed to load vendor profile:", error);
    }
  };

  const previewDoc = (doc: VendorDocumentDto) => {
    if (!doc.fileUrl) {
      toast.info("Preview is available for uploaded files.");
      return;
    }
    const previewUrl = getPreviewUrl(doc.fileUrl);
    setPreviewDocument({ url: previewUrl, type: doc.documentType });
  };

  const getPreviewUrl = (fileUrl: string): string => {
    const normalizedUrl = normalizeHostedFileUrl(fileUrl);
    if (!normalizedUrl.startsWith("data:")) return normalizedUrl;
    try {
      const [meta, data] = normalizedUrl.split(",");
      if (!meta || !data) return normalizedUrl;
      const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "application/octet-stream";
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch {
      return normalizedUrl;
    }
  };

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getVendors();
      setVendors(data);
      
      // Load all vendor profiles
      const profilesMap = new Map<string, VendorProfileDto>();
      await Promise.allSettled(
        data.map(async (vendor) => {
          try {
            const profile = await adminApi.getVendorProfile(vendor.id);
            profilesMap.set(vendor.id, profile);
          } catch (error) {
            console.error(`Failed to load profile for vendor ${vendor.id}:`, error);
          }
        })
      );
      setVendorProfiles(profilesMap);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyDocumentItem = async (vendorId: string, documentId: string, verificationStatus: "approved" | "rejected", notes?: string) => {
    const adminUserId = getAdminUserId();
    if (!adminUserId) {
      toast.error("Admin session not found. Please login again.");
      return;
    }

    const key = `doc-${documentId}-${verificationStatus}`;
    setItemActionLoadingKey(key);
    try {
      await adminApi.verifyVendorDocument({
        adminUserId,
        vendorId,
        documentId,
        verificationStatus,
        notes,
      });
      await loadDocuments(vendorId);
      await loadVendors();
      toast.success(`Document ${verificationStatus}.`);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setItemActionLoadingKey(null);
    }
  };

  const verifyBankItem = async (vendorId: string, bankAccountId: string, verificationStatus: "approved" | "rejected", notes?: string) => {
    const adminUserId = getAdminUserId();
    if (!adminUserId) {
      toast.error("Admin session not found. Please login again.");
      return;
    }

    const key = `bank-${bankAccountId}-${verificationStatus}`;
    setItemActionLoadingKey(key);
    try {
      await adminApi.verifyVendorBankAccount({
        adminUserId,
        vendorId,
        bankAccountId,
        verificationStatus,
        notes,
      });
      await loadBankAccounts(vendorId);
      await loadVendors();
      toast.success(`Bank account ${verificationStatus}.`);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setItemActionLoadingKey(null);
    }
  };

  const openItemRejectDialog = (kind: "doc" | "bank", vendorId: string, itemId: string) => {
    setItemRejectTarget({ kind, vendorId, itemId });
    setItemRejectNotes("");
    setItemRejectOpen(true);
  };

  const submitItemReject = async () => {
    if (!itemRejectTarget) return;

    if (itemRejectTarget.kind === "doc") {
      await verifyDocumentItem(itemRejectTarget.vendorId, itemRejectTarget.itemId, "rejected", itemRejectNotes || undefined);
    } else {
      await verifyBankItem(itemRejectTarget.vendorId, itemRejectTarget.itemId, "rejected", itemRejectNotes || undefined);
    }

    setItemRejectOpen(false);
    setItemRejectTarget(null);
    setItemRejectNotes("");
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
      // Reload vendors to get updated status from backend
      await loadVendors();
      setSelected(null);
      toast.success("Vendor approved");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
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
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor rejected with reason");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
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
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor suspended successfully");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
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
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor banned successfully");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
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
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor reactivated successfully");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
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
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Registration Stage</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((v) => {
                const profile = vendorProfiles.get(v.id);
                return (
                  <tr key={v.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-soft text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate" title={profile?.businessName || v.email}>{profile?.businessName || v.email}</p>
                          <p className="text-xs text-muted-foreground truncate" title={v.email}>{v.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{v.registrationStage}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.accountStatus as "pending" | "approved" | "rejected" | "under_review"} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(v)}>Review</Button>
                    </td>
                  </tr>
                );
              })}
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
                    <h3 className="text-lg font-bold">{vendorProfile?.businessName || selected.email}</h3>
                    <p className="text-sm text-muted-foreground">Registration Stage: {selected.registrationStage}</p>
                  </div>
                  <StatusBadge status={selected.accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate" title={selected.email}>{selected.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Email Verified: {selected.emailVerified ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold">Documents</h4>
                  <span className="text-xs text-muted-foreground">{documents.length} uploaded</span>
                </div>
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{d.documentType}</p>
                            <p className="text-xs text-muted-foreground">{d.documentNumber || "No number"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={d.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} />
                          {selected && d.verificationStatus !== "approved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void verifyDocumentItem(selected.id, d.id, "approved")}
                              className="h-7 w-7"
                              aria-label="Approve document"
                              disabled={verifying || itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `doc-${d.id}-approved` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-success" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              )}
                            </Button>
                          )}
                          {selected && d.verificationStatus !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openItemRejectDialog("doc", selected.id, d.id)}
                              className="h-7 w-7"
                              aria-label="Reject document"
                              disabled={verifying || itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `doc-${d.id}-rejected` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => previewDoc(d)}
                            className="h-7 w-7"
                            aria-label="Preview document"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No documents uploaded.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold">Bank Accounts</h4>
                  <span className="text-xs text-muted-foreground">{bankAccounts.length} added</span>
                </div>
                {loadingBanks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : bankAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {bankAccounts.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{b.bankName}</p>
                            <p className="text-xs text-muted-foreground">{b.accountHolderName} {b.accountNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} />
                          {selected && b.verificationStatus !== "approved" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void verifyBankItem(selected.id, b.id, "approved")}
                              className="h-7 w-7"
                              aria-label="Approve bank account"
                              disabled={verifying || itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `bank-${b.id}-approved` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-success" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              )}
                            </Button>
                          )}
                          {selected && b.verificationStatus !== "rejected" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openItemRejectDialog("bank", selected.id, b.id)}
                              className="h-7 w-7"
                              aria-label="Reject bank account"
                              disabled={verifying || itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `bank-${b.id}-rejected` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No bank accounts added.
                  </div>
                )}
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
            {/* Only show main approve button for non-active vendors */}
            {selected?.accountStatus !== "active" && (
              <Button onClick={() => selected && approve(selected.id)} className="bg-success hover:bg-success/90 text-success-foreground" disabled={verifying}>
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
              </Button>
            )}
            {/* Show indicator for active vendors with pending documents */}
            {selected?.accountStatus === "active" && selected?.registrationStage === "documents_pending" && (
              <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                Document replacement pending - approve individual documents below
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemRejectOpen} onOpenChange={setItemRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {itemRejectTarget?.kind === "bank" ? "bank account" : "document"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <div className="space-y-1.5">
              <Label>Optional notes</Label>
              <Textarea
                value={itemRejectNotes}
                onChange={(e) => setItemRejectNotes(e.target.value)}
                placeholder="Provide reason for rejection (optional)..."
                rows={4}
              />
            </div>
            <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemRejectOpen(false)} disabled={itemActionLoadingKey !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submitItemReject()} disabled={itemActionLoadingKey !== null || !itemRejectTarget}>
              {itemActionLoadingKey !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
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

      {/* Document Preview Modal */}
      <Dialog open={previewDocument !== null} onOpenChange={(open) => !open && setPreviewDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Preview - {previewDocument?.type}</DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div className="w-full h-[70vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
              {previewDocument.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={previewDocument.url}
                  alt="Document preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : previewDocument.url.match(/\.pdf$/i) ? (
                <iframe
                  src={previewDocument.url}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type.
                    <a
                      href={previewDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-2"
                    >
                      Download file
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Verification;
