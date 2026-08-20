import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Search, CheckCircle2, XCircle, Building2, Mail, Loader2, MoreVertical, Ban, ShieldAlert, RotateCcw, FileText, Eye, Building, AlertCircle, Calendar, MapPin, ExternalLink } from "lucide-react";
import { IconTooltip } from "@/app/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import { Textarea } from "@/app/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { toast } from "sonner";
import { safeFormatDate } from "@/app/utils/dateUtils";
import { adminApi, VendorDto, VendorProfileDto, VendorDocumentDto, VendorBankAccountDto, VendorServiceAreaDto } from "@/app/services/adminApi";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { retryOriginalOnImageError } from "@/app/helpers/utils";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { AdminServiceAreaRadiusDialog } from "@/app/components/admin/AdminServiceAreaRadiusDialog";

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
    // Keep absolute external URLs (like S3 presigned URLs) untouched.
    const isAbsolute = /^https?:\/\//i.test(fileUrl);
    if (isAbsolute) {
      const absolute = new URL(fileUrl);
      if (absolute.origin !== apiOrigin) {
        return fileUrl;
      }
    }

    // Support relative/local-hosted paths and pin uploads to current API host.
    const parsed = new URL(fileUrl, apiOrigin);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return fileUrl;
  }
};

const getFileExtensionFromUrl = (url: string): string => {
  const fromName = (name: string): string => {
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match?.[1] ?? "";
  };

  try {
    const parsed = new URL(url, window.location.origin);
    const directName = decodeURIComponent(parsed.pathname.split("/").pop() ?? "");
    const nestedUrl = parsed.searchParams.get("url");
    if (nestedUrl) {
      const nested = new URL(nestedUrl, window.location.origin);
      const nestedName = decodeURIComponent(nested.pathname.split("/").pop() ?? "");
      return fromName(nestedName) || fromName(directName);
    }
    return fromName(directName);
  } catch {
    const cleaned = url.split("?")[0]?.split("#")[0] ?? "";
    const name = cleaned.split("/").pop() ?? "";
    return fromName(name);
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

const downloadUrl = async (url: string) => {
  try {
    const token = localStorage.getItem('vendor_portal_token');
    const headers: HeadersInit = {};
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
    if (token && (url.startsWith(apiBase) || url.startsWith(window.location.origin))) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error('Download failed');
    const blob = await resp.blob();
    const parsed = new URL(url, window.location.origin);
    const filename = decodeURIComponent((parsed.pathname.split('/').pop() || 'file'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error(err);
    toast.error('Download failed.');
  }
};

const VerificationDetail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="mb-1 text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium break-all">{value || "—"}</p>
  </div>
);

const BankAccountDetailsGrid = ({ bank }: { bank: VendorBankAccountDto }) => (
  <div className="grid grid-cols-1 gap-3 rounded-md border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
    <VerificationDetail label="Account holder" value={bank.accountHolderName} />
    <VerificationDetail label="Bank name" value={bank.bankName} />
    <VerificationDetail label="Account number" value={bank.accountNumber} />
    <VerificationDetail label="IFSC code" value={bank.ifscCode} />
  </div>
);

const Verification = () => {
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get("status") as "all" | "pending" | "active" | "rejected" | "suspended" | "banned") ?? "all";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "rejected" | "suspended" | "banned">(
    ["all", "pending", "active", "rejected", "suspended", "banned"].includes(initialFilter) ? initialFilter : "all"
  );

  useEffect(() => {
    const s = searchParams.get("status") as "all" | "pending" | "active" | "rejected" | "suspended" | "banned";
    if (s && ["all", "pending", "active", "rejected", "suspended", "banned"].includes(s)) {
      setFilter(s);
    } else if (!s) {
      setFilter("all");
    }
  }, [searchParams]);

  const handleFilterChange = (v: string) => {
    const val = v as "all" | "pending" | "active" | "rejected" | "suspended" | "banned";
    setFilter(val);
    if (val === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", val);
    }
    setSearchParams(searchParams, { replace: true });
  };
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
  const [previewBank, setPreviewBank] = useState<VendorBankAccountDto | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [vendorProfile, setVendorProfile] = useState<VendorProfileDto | null>(null);
  const [vendorProfiles, setVendorProfiles] = useState<Map<string, VendorProfileDto>>(new Map());
  const [serviceAreas, setServiceAreas] = useState<VendorServiceAreaDto[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [radiusEditArea, setRadiusEditArea] = useState<VendorServiceAreaDto | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadVendors();
  }, []);

  // Load documents when a vendor is selected
  useEffect(() => {
    if (selected) {
      loadDocuments(selected.id);
      loadBankAccounts(selected.id);
      loadVendorProfile(selected.id);
      loadServiceAreas(selected.id);
    } else {
      setDocuments([]);
      setBankAccounts([]);
      setVendorProfile(null);
      setServiceAreas([]);
      setRadiusEditArea(null);
    }
  }, [selected]);

  // Auto-refresh documents every 30 seconds when dialog is open
  useEffect(() => {
    if (!selected) return;

    const interval = setInterval(() => {
      loadDocuments(selected.id);
    }, 30000);

    return () => clearInterval(interval);
  }, [selected]);

  const loadDocuments = async (vendorId: string) => {
    setLoadingDocs(true);
    try {
      const docs = await adminApi.getVendorDocuments(vendorId);
      setDocuments(docs);
    } catch {
      // Documents not found - vendor hasn't uploaded yet, this is expected
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadBankAccounts = async (vendorId: string) => {
    setLoadingBanks(true);
    try {
      const banks = await adminApi.getVendorBankAccounts(vendorId);
      setBankAccounts(banks);
    } catch {
      // Bank accounts not found - vendor hasn't added yet, this is expected
    } finally {
      setLoadingBanks(false);
    }
  };

  const loadServiceAreas = async (vendorId: string) => {
    setLoadingAreas(true);
    try {
      const areas = await adminApi.getVendorServiceAreas(vendorId);
      setServiceAreas(areas);
    } catch {
      setServiceAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadVendorProfile = async (vendorId: string) => {
    try {
      const profile = await adminApi.getVendorProfile(vendorId);
      setVendorProfile(profile);
    } catch {
      // Profile not found - vendor hasn't submitted profile yet, this is expected
    }
  };

  const openPreview = (doc: VendorDocumentDto) => {
    const previewUrl = getPreviewUrl(doc.fileUrl);
    setPdfLoading(true);
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
          } catch {
            // Profile not found - vendor hasn't submitted profile yet, this is expected
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
      // Send notification to vendor
      try {
        const docTitle = "Document";
        if (verificationStatus === "approved") {
          await vendorOnboardingApi.createNotification(vendorId, "Document Approved", `Your ${docTitle} has been approved by the admin.`, "success");
        } else {
          const msg = notes ? `Your ${docTitle} has been rejected. Reason: ${notes}` : `Your ${docTitle} has been rejected. Please upload a valid document.`;
          await vendorOnboardingApi.createNotification(vendorId, "Document Rejected", msg, "error");
        }
      } catch (notifyError) {
        console.error("Failed to send document verification notification:", notifyError);
      }
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
      
      // Send notification to vendor
      try {
        if (verificationStatus === "approved") {
          await vendorOnboardingApi.createNotification(vendorId, "Bank Account Verified", "Your bank account has been successfully verified by the admin.", "success");
        } else {
          const msg = notes ? `Your bank account has been rejected. Reason: ${notes}` : "Your bank account has been rejected. Please add a valid bank account.";
          await vendorOnboardingApi.createNotification(vendorId, "Bank Account Rejected", msg, "error");
        }
      } catch (notifyError) {
        console.error("Failed to send bank verification notification:", notifyError);
      }
      
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
    const hasProfile = vendorProfiles.has(v.id);
    
    // Check if the vendor has progressed past the initial registration stages.
    // If they have uploaded a document, their stage is usually documents_pending or later.
    const isReadyForVerification = 
      v.registrationStage !== "email_registered" && 
      v.registrationStage !== "profile_pending";

    const m = filter === "all" || v.accountStatus === filter;
    const s = !search || v.email.toLowerCase().includes(search.toLowerCase());
    
    return hasProfile && isReadyForVerification && m && s;
  });

  const serviceAreasNeedRadiusReview =
    serviceAreas.length === 0 || serviceAreas.some((a) => !a.isRadiusSetByAdmin);

  const docsReady = documents.length > 0 && documents.every((d) => d.verificationStatus === "approved");
  const bankReady = bankAccounts.length > 0 && bankAccounts.some((b) => b.verificationStatus === "approved");
  const radiusReady = serviceAreas.length > 0 && serviceAreas.every((a) => a.isRadiusSetByAdmin);

  const canApprove =
    !!selected &&
    selected.accountStatus === "pending" &&
    docsReady &&
    bankReady &&
    radiusReady;

  const openAreasPage = (vendorId: string, editRadius = false) => {
    const qs = editRadius ? "?tab=areas&editRadius=1" : "?tab=areas";
    navigate(`/admin/vendors/${vendorId}${qs}`);
  };

  const openFirstPendingRadius = () => {
    const pending = serviceAreas.find((a) => !a.isRadiusSetByAdmin) ?? serviceAreas[0];
    if (pending) setRadiusEditArea(pending);
  };

  const approve = async (id: string) => {
    if (!canApprove) {
      if (serviceAreasNeedRadiusReview) {
        toast.error(
          serviceAreas.length === 0
            ? "Vendor has no service area yet. Open Areas to review the business location."
            : "Set coverage radius for all service areas before approval.",
          {
            action: {
              label: serviceAreas.length === 0 ? "Open Areas" : "Set radius",
              onClick: () => {
                if (serviceAreas.length === 0) openAreasPage(id);
                else openFirstPendingRadius();
              },
            },
          },
        );
      } else if (!docsReady) {
        toast.error("Approve all required documents before vendor approval.");
      } else if (!bankReady) {
        toast.error("Approve at least one bank account before vendor approval.");
      }
      return;
    }

    setVerifying(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.approveVendor({ adminUserId, vendorId: id });
      // Send notification to vendor
      try {
        await vendorOnboardingApi.createNotification(id, "Account Approved", "Congratulations! Your vendor account has been approved. You can now start listing products and receiving orders.", "success");
      } catch (notifyError) {
        console.error("Failed to send approval notification:", notifyError);
      }
      await loadVendors();
      setSelected(null);
      toast.success("Vendor approved successfully");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      const radiusBlocked =
        message.toLowerCase().includes("coverage radius") ||
        message.toLowerCase().includes("service area");
      toast.error(message, radiusBlocked ? {
        action: {
          label: "Set radius",
          onClick: () => openFirstPendingRadius(),
        },
      } : undefined);
    } finally {
      setVerifying(false);
    }
  };

  const reject = async (id: string) => {
    setVerifying(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.rejectVendor({ adminUserId, vendorId: id, reason });
      // Send notification to vendor
      try {
        const message = reason ? `Your vendor application has been rejected. Reason: ${reason}` : "Your vendor application has been rejected. Please contact support for more information.";
        await vendorOnboardingApi.createNotification(id, "Application Rejected", message, "error");
      } catch (notifyError) {
        console.error("Failed to send rejection notification:", notifyError);
      }
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor rejected");
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
      // Send notification to vendor
      try {
        const message = reason ? `Your account has been suspended. Reason: ${reason}` : "Your account has been suspended. Please contact support for more information.";
        await vendorOnboardingApi.createNotification(id, "Account Suspended", message, "warning");
      } catch (notifyError) {
        console.error("Failed to send suspension notification:", notifyError);
      }
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor suspended");
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
      // Send notification to vendor
      try {
        const message = reason ? `Your account has been banned. Reason: ${reason}` : "Your account has been banned. Please contact support for more information.";
        await vendorOnboardingApi.createNotification(id, "Account Banned", message, "error");
      } catch (notifyError) {
        console.error("Failed to send ban notification:", notifyError);
      }
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor banned");
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
      // Send notification to vendor
      try {
        const message = "Your account has been reactivated. You can now resume your vendor activities.";
        await vendorOnboardingApi.createNotification(id, "Account Reactivated", message, "success");
      } catch (notifyError) {
        console.error("Failed to send reactivation notification:", notifyError);
      }
      await loadVendors();
      setSelected(null);
      setReason("");
      setRejectOpen(false);
      toast.success("Vendor reactivated");
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
          <Tabs value={filter} onValueChange={handleFilterChange}>
            <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto rounded-lg p-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
              <TabsTrigger value="banned">Ban</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {loading ? (
          <PageLoaderSlot />
        ) : (
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
                            <p className="text-xs text-muted-foreground truncate" title={v.email}>
                              <CopyableEmail email={v.email} textClassName="text-xs text-muted-foreground" />
                            </p>
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
        )}
      </Card>

      {/* Vendor detail */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
                    <CopyableEmail
                      email={selected.email}
                      compact={false}
                      textClassName="text-sm truncate"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>Email Verified: {selected.isEmailVerified ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-semibold">Documents</h4>
                  <span className="text-xs text-muted-foreground">{documents.length} uploaded</span>
                </div>
                {loadingDocs ? (
                  <PageLoaderSlot className="min-h-[6rem]" />
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((d) => (
                      <div key={d.id} className="rounded-lg border border-border p-3">
                        {/* Desktop: horizontal layout */}
                        <div className="hidden sm:flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{d.documentType}</p>
                              {d.documentNumber && <p className="text-xs text-muted-foreground truncate">{d.documentNumber}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge status={d.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} />
                            {selected && d.verificationStatus !== "approved" && (
                              <IconTooltip label="Approve document">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void verifyDocumentItem(selected.id, d.id, "approved")}
                                className="h-8 w-8"
                                aria-label="Approve document"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `doc-${d.id}-approved` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-success" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                )}
                              </Button>
                              </IconTooltip>
                            )}
                            {selected && d.verificationStatus !== "rejected" && (
                              <IconTooltip label="Reject document">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openItemRejectDialog("doc", selected.id, d.id)}
                                className="h-8 w-8"
                                aria-label="Reject document"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `doc-${d.id}-rejected` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                              </IconTooltip>
                            )}
                            <IconTooltip label="Preview document">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPreview(d)}
                              className="h-8 w-8"
                              aria-label="Preview document"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            </IconTooltip>
                          </div>
                        </div>
                        {/* Mobile: vertical layout with actions below */}
                        <div className="sm:hidden">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-sm font-medium leading-tight flex-1">{d.documentType}</p>
                                <StatusBadge status={d.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} className="text-[10px] px-2 py-0.5 shrink-0" />
                              </div>
                              {d.documentNumber && <p className="text-xs text-muted-foreground mt-0.5 break-all line-clamp-1">{d.documentNumber}</p>}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {selected && d.verificationStatus !== "approved" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void verifyDocumentItem(selected.id, d.id, "approved")}
                                className="h-8 px-1 text-[10px]"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `doc-${d.id}-approved` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                )}
                                <span className="ml-1">Approve</span>
                              </Button>
                            ) : (
                              <div />
                            )}
                            {selected && d.verificationStatus !== "rejected" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openItemRejectDialog("doc", selected.id, d.id)}
                                className="h-8 px-1 text-[10px]"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `doc-${d.id}-rejected` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className="ml-1">Reject</span>
                              </Button>
                            ) : (
                              <div />
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPreview(d)}
                              className="h-8 px-1 text-[10px]"
                            >
                              <Eye className="h-3 w-3" />
                              <span className="ml-1">Preview</span>
                            </Button>
                          </div>
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
                  <PageLoaderSlot className="min-h-[6rem]" />
                ) : bankAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {bankAccounts.map((b) => (
                      <div key={b.id} className="rounded-lg border border-border p-3">
                        {/* Desktop: horizontal layout — same pattern as documents */}
                        <div className="hidden sm:flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                              <Building className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{b.bankName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {b.accountHolderName}
                                {b.accountNumber.length > 4 ? ` ···${b.accountNumber.slice(-4)}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge status={b.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} />
                            {selected && b.verificationStatus !== "approved" && (
                              <IconTooltip label="Approve bank account">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void verifyBankItem(selected.id, b.id, "approved")}
                                className="h-8 w-8"
                                aria-label="Approve bank account"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${b.id}-approved` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-success" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                )}
                              </Button>
                              </IconTooltip>
                            )}
                            {selected && b.verificationStatus !== "rejected" && (
                              <IconTooltip label="Reject bank account">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openItemRejectDialog("bank", selected.id, b.id)}
                                className="h-8 w-8"
                                aria-label="Reject bank account"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${b.id}-rejected` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                              </IconTooltip>
                            )}
                            <IconTooltip label="View bank details">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewBank(b)}
                              className="h-8 w-8"
                              aria-label="View bank details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            </IconTooltip>
                          </div>
                        </div>
                        {/* Mobile: vertical layout with actions below */}
                        <div className="sm:hidden space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                              <Building className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2">
                                <p className="text-sm font-medium leading-tight flex-1">{b.bankName}</p>
                                <StatusBadge status={b.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} className="text-[10px] px-2 py-0.5 shrink-0" />
                              </div>
                            </div>
                          </div>
                          <BankAccountDetailsGrid bank={b} />
                          <div className="flex flex-wrap justify-end gap-2">
                            {selected && b.verificationStatus !== "approved" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void verifyBankItem(selected.id, b.id, "approved")}
                                className="h-8 px-2 text-xs"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${b.id}-approved` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                )}
                                <span className="ml-1">Approve</span>
                              </Button>
                            ) : null}
                            {selected && b.verificationStatus !== "rejected" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openItemRejectDialog("bank", selected.id, b.id)}
                                className="h-8 px-2 text-xs"
                                disabled={verifying || itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${b.id}-rejected` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className="ml-1">Reject</span>
                              </Button>
                            ) : null}
                          </div>
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

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">Service coverage</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Admin must set coverage radius before approval.
                    </p>
                  </div>
                  {serviceAreasNeedRadiusReview ? (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                      Needs radius
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                      Ready
                    </Badge>
                  )}
                </div>
                {loadingAreas ? (
                  <PageLoaderSlot className="min-h-[6rem]" />
                ) : serviceAreas.length > 0 ? (
                  <div className="space-y-2">
                    {serviceAreas.map((area) => (
                      <div
                        key={area.id}
                        className={`rounded-lg border p-3 ${
                          area.isRadiusSetByAdmin ? "border-border" : "border-amber-500/40"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{area.areaName}</p>
                              {area.isRadiusSetByAdmin ? (
                                <Badge
                                  variant="outline"
                                  className="border-success/40 bg-success/10 text-[10px] text-success"
                                >
                                  Radius set
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-200"
                                >
                                  Needs Admin review
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {area.city} · {area.serviceRadiusKm} km
                              {area.isRadiusSetByAdmin ? " (set by Admin)" : " default"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Pin {area.centerLatitude.toFixed(4)}, {area.centerLongitude.toFixed(4)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              size="sm"
                              variant={area.isRadiusSetByAdmin ? "outline" : "default"}
                              onClick={() => setRadiusEditArea(area)}
                            >
                              {area.isRadiusSetByAdmin ? "Edit radius" : "Set radius"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0 text-xs"
                      onClick={() => selected && openAreasPage(selected.id)}
                    >
                      Open full Areas page
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm text-muted-foreground">
                      No service area / business location found for this vendor yet.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selected && openAreasPage(selected.id, true)}
                    >
                      Open Areas page
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={verifying}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => selected && openAreasPage(selected.id, serviceAreasNeedRadiusReview)}
                >
                  <MapPin className="mr-2 h-4 w-4" /> Open Areas page
                </DropdownMenuItem>
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
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  onClick={() => selected && void approve(selected.id)}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  disabled={
                    verifying ||
                    loadingAreas ||
                    (selected?.accountStatus === "pending" && !canApprove)
                  }
                >
                  {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
                </Button>
                {selected?.accountStatus === "pending" && !loadingAreas && serviceAreasNeedRadiusReview && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 sm:text-right">
                    {serviceAreas.length === 0
                      ? "Set service area radius on Areas before approval."
                      : "Set coverage radius for all service areas before approval."}
                  </p>
                )}
              </div>
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

      {selected && (
        <AdminServiceAreaRadiusDialog
          vendorId={selected.id}
          area={radiusEditArea}
          open={Boolean(radiusEditArea)}
          onOpenChange={(open) => {
            if (!open) setRadiusEditArea(null);
          }}
          onSaved={(updated) => {
            setServiceAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          }}
        />
      )}

      <Dialog open={itemRejectOpen} onOpenChange={setItemRejectOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
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
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" onClick={() => setItemRejectOpen(false)} disabled={itemActionLoadingKey !== null} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submitItemReject()} disabled={itemActionLoadingKey !== null || !itemRejectTarget} className="w-full sm:w-auto">
              {itemActionLoadingKey !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
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
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={verifying} className="w-full sm:w-auto">Cancel</Button>
            <Button variant={actionType === "reactivate" ? "default" : "destructive"} onClick={handleAction} disabled={verifying} className="w-full sm:w-auto">
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={previewDocument !== null} onOpenChange={(open) => { if (!open) { setPreviewDocument(null); setPdfLoading(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Preview - {previewDocument?.type}</DialogTitle>
          </DialogHeader>
          {previewDocument && (
            <div className="w-full h-[60vh] flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden relative">
              {(() => {
                const extension = getFileExtensionFromUrl(previewDocument.url);
                const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);
                const isPdf = extension === "pdf";

                if (isImage) {
                  return (
                <img
                  src={previewDocument.url}
                  alt="Document preview"
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => setPdfLoading(false)}
                  onError={retryOriginalOnImageError}
                />
                  );
                }

                if (isPdf) {
                  return (
                <>
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">Loading PDF...</p>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={previewDocument.url}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                    onLoad={() => setPdfLoading(false)}
                    onError={() => {
                      setPdfLoading(false);
                      toast.error("Failed to load PDF. Please try downloading the file instead.");
                    }}
                  />
                </>
                  );
                }

                return (
                <div className="text-center p-6">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Preview not available for this file type.
                    <button
                      type="button"
                      onClick={() => void downloadUrl(previewDocument.url)}
                      className="text-primary hover:underline ml-2"
                    >
                      Download file
                    </button>
                  </p>
                </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewDocument(null);
                setPdfLoading(false);
              }}
            >
              Close
            </Button>
            {previewDocument && (
              <Button onClick={() => void downloadUrl(previewDocument.url)}>
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank account details modal — opened via eye icon, like document preview */}
      <Dialog open={previewBank !== null} onOpenChange={(open) => { if (!open) setPreviewBank(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bank account details — {previewBank?.bankName}</DialogTitle>
          </DialogHeader>
          {previewBank && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{previewBank.bankName}</p>
                  <p className="text-sm text-muted-foreground truncate">{previewBank.accountHolderName}</p>
                </div>
                <StatusBadge
                  status={previewBank.verificationStatus as "pending" | "approved" | "rejected" | "under_review"}
                  className="shrink-0"
                />
              </div>
              <BankAccountDetailsGrid bank={previewBank} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewBank(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Verification;
