import { ReactNode, useState, useEffect } from "react";

import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/app/components/shared/PageHeader";

import { Card } from "@/app/components/ui/card";

import { Skeleton } from "@/app/components/ui/skeleton";

import { Button } from "@/app/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

import { StatusBadge } from "@/app/components/shared/StatusBadge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";

import { Label } from "@/app/components/ui/label";

import { Textarea } from "@/app/components/ui/textarea";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";

import { adminApi, VendorDto, VendorProfileDto, VendorDocumentDto, VendorBankAccountDto, VendorServiceAreaDto, VendorWorkingHourDto, VendorProductListingDto } from "@/app/services/adminApi";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

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

import {
  Building2,
  ChevronLeft,
  CircleOff,
  Clock3,
  FileText,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  MoreVertical,
  Ban,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";

import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";


const dayLabel: Record<number, string> = {

  0: "Monday",

  1: "Tuesday",

  2: "Wednesday",

  3: "Thursday",

  4: "Friday",

  5: "Saturday",

  6: "Sunday",

};


const vendorTabs = ["profile", "docs", "bank", "areas", "products"] as const;

type VendorTab = (typeof vendorTabs)[number];



const VendorDetails = () => {

  const { vendorId } = useParams();

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);

  const [approving, setApproving] = useState(false);

  const [rejecting, setRejecting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);

  const [rejectReason, setRejectReason] = useState("");

  const [actionType, setActionType] = useState<"reject" | "suspend" | "ban" | "reactivate">("reject");
  const [itemActionLoadingKey, setItemActionLoadingKey] = useState<string | null>(null);
  const [itemRejectOpen, setItemRejectOpen] = useState(false);
  const [itemRejectNotes, setItemRejectNotes] = useState("");
  const [itemRejectTarget, setItemRejectTarget] = useState<{ kind: "doc" | "bank"; itemId: string } | null>(null);

  const [vendor, setVendor] = useState<VendorDto | null>(null);

  const [profile, setProfile] = useState<VendorProfileDto | null>(null);

  const [documents, setDocuments] = useState<VendorDocumentDto[]>([]);

  const [bankAccounts, setBankAccounts] = useState<VendorBankAccountDto[]>([]);

  const [serviceAreas, setServiceAreas] = useState<VendorServiceAreaDto[]>([]);



  const [productListings, setProductListings] = useState<VendorProductListingDto[]>([]);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);



  useEffect(() => {

    if (!vendorId) return;

    loadVendorData(vendorId);

  }, [vendorId]);



  const loadVendorData = async (id: string) => {

    setLoading(true);

    try {

      // Get vendor from the list (we can fetch all and filter, or create a getVendorById endpoint)

      const vendors = await adminApi.getVendors();

      const vendorData = vendors.find((v) => v.id === id);

      if (!vendorData) {

        throw new Error("Vendor not found");

      }

      setVendor(vendorData);



      // Fetch all vendor details in parallel

      const [profileData, docsData, bankData, areasData, listingsData] = await Promise.all([

        adminApi.getVendorProfile(id).catch(() => null),

        adminApi.getVendorDocuments(id).catch(() => []),

        adminApi.getVendorBankAccounts(id).catch(() => []),

        adminApi.getVendorServiceAreas(id).catch(() => []),

        adminApi.getVendorProductListings(id).catch(() => []),

      ]);



      setProfile(profileData);

      setDocuments(docsData);

      setBankAccounts(bankData);

      setServiceAreas(areasData);



      setProductListings(listingsData);

    } catch (error) {
      const message = getUserFriendlyMessage(error);

      toast.error(message);

    } finally {

      setLoading(false);

    }

  };



  if (!vendorId) return <Navigate to="/admin/vendors" replace />;

  if (!vendor && !loading) {

    return (

      <Card className="border-border/60 p-6">

        <h2 className="text-lg font-semibold">Vendor not found</h2>

        <p className="mt-1 text-sm text-muted-foreground">This vendor does not exist or may have been removed.</p>

        <Button className="mt-4" variant="outline" onClick={() => navigate("/admin/vendors")}>

          <ChevronLeft className="mr-2 h-4 w-4" /> Back to vendors

        </Button>

      </Card>

    );

  }



  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-20" />
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card Skeleton */}
              <Card className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Documents Skeleton */}
              <Card className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-24" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-border/60 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Sidebar Skeleton */}
            <div className="space-y-4">
              <Card className="p-6">
                <Skeleton className="h-6 w-24 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );

  }





  const queryTab = searchParams.get("tab");

  const activeTab: VendorTab = vendorTabs.includes((queryTab ?? "") as VendorTab) ? (queryTab as VendorTab) : "profile";



  const onTabChange = (tab: string) => {

    if (!vendorTabs.includes(tab as VendorTab)) return;

    setSearchParams({ tab });

  };



  const approve = async () => {

    if (!vendorId) return;

    setApproving(true);

    try {

      // TODO: Get adminUserId from auth context

      const adminUserId = getAdminUserId() || "";

      await adminApi.approveVendor({ adminUserId, vendorId });

      toast.success("Vendor approved successfully");

      loadVendorData(vendorId);

    } catch (error) {
      const message = getUserFriendlyMessage(error);

      toast.error(message);

    } finally {

      setApproving(false);

    }

  };

  const verifyDocumentItem = async (targetDocumentId: string, verificationStatus: "approved" | "rejected", notes?: string) => {
    if (!vendorId) return;
    const adminUserId = getAdminUserId();
    if (!adminUserId) {
      toast.error("Admin session not found. Please login again.");
      return;
    }

    const key = `doc-${targetDocumentId}-${verificationStatus}`;
    setItemActionLoadingKey(key);
    try {
      await adminApi.verifyVendorDocument({
        adminUserId,
        vendorId,
        documentId: targetDocumentId,
        verificationStatus,
        notes,
      });
      await loadVendorData(vendorId);
      toast.success(`Document ${verificationStatus}.`);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setItemActionLoadingKey(null);
    }
  };

  const verifyBankItem = async (bankAccountId: string, verificationStatus: "approved" | "rejected", notes?: string) => {
    if (!vendorId) return;
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
      
      // Only create notification for approvals (backend handles rejections)
      if (verificationStatus === "approved") {
        const title = "Bank Account Verified";
        const message = "Your bank account has been successfully verified by the admin.";
        
        await vendorOnboardingApi.createNotification(vendorId, title, message, "success");
      }
      
      await loadVendorData(vendorId);
      toast.success(`Bank account ${verificationStatus}.`);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setItemActionLoadingKey(null);
    }
  };

  const previewDoc = (fileUrl: string, documentType: string) => {
    if (!fileUrl) {
      toast.info("No document URL found.");
      return;
    }
    const normalizedUrl = normalizeHostedFileUrl(fileUrl);
    setPdfLoading(true);
    setPreviewDocument({ url: normalizedUrl, type: documentType });
  };

  const openItemRejectDialog = (kind: "doc" | "bank", itemId: string) => {
    setItemRejectTarget({ kind, itemId });
    setItemRejectNotes("");
    setItemRejectOpen(true);
  };

  const submitItemReject = async () => {
    if (!itemRejectTarget) return;

    if (itemRejectTarget.kind === "doc") {
      await verifyDocumentItem(itemRejectTarget.itemId, "rejected", itemRejectNotes || undefined);
    } else {
      await verifyBankItem(itemRejectTarget.itemId, "rejected", itemRejectNotes || undefined);
    }

    setItemRejectOpen(false);
    setItemRejectTarget(null);
    setItemRejectNotes("");
  };



  const reject = async () => {

    if (!vendorId) return;

    setRejecting(true);

    try {

      // TODO: Get adminUserId from auth context

      const adminUserId = getAdminUserId() || "";

      await adminApi.rejectVendor({ adminUserId, vendorId, reason: rejectReason });

      toast.success("Vendor rejected successfully");

      setRejectOpen(false);

      setRejectReason("");

      loadVendorData(vendorId);

    } catch (error) {
      const message = getUserFriendlyMessage(error);

      toast.error(message);

    } finally {

      setRejecting(false);

    }

  };

  const suspend = async () => {
    if (!vendorId) return;
    setRejecting(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.suspendVendor({ adminUserId, vendorId, reason: rejectReason });
      toast.success("Vendor suspended successfully");
      setRejectOpen(false);
      setRejectReason("");
      loadVendorData(vendorId);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setRejecting(false);
    }
  };

  const ban = async () => {
    if (!vendorId) return;
    setRejecting(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.banVendor({ adminUserId, vendorId, reason: rejectReason });
      toast.success("Vendor banned successfully");
      setRejectOpen(false);
      setRejectReason("");
      loadVendorData(vendorId);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setRejecting(false);
    }
  };

  const reactivate = async () => {
    if (!vendorId) return;
    setRejecting(true);
    try {
      const adminUserId = getAdminUserId() || "";
      await adminApi.reactivateVendor({ adminUserId, vendorId, reason: rejectReason });
      toast.success("Vendor reactivated successfully");
      setRejectOpen(false);
      setRejectReason("");
      loadVendorData(vendorId);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setRejecting(false);
    }
  };

  const handleAction = () => {
    if (actionType === "reject") {
      reject();
    } else if (actionType === "suspend") {
      suspend();
    } else if (actionType === "ban") {
      ban();
    } else if (actionType === "reactivate") {
      reactivate();
    }
  };



  const canApprove = vendor?.accountStatus === "pending" &&

    documents.length > 0 && documents.every(d => d.verificationStatus === "approved") &&

    bankAccounts.length > 0 && bankAccounts.some(b => b.verificationStatus === "approved");



  return (

    <div>

      <PageHeader

        title={profile?.businessName || vendor?.email || "Vendor"}

        description={profile ? `${profile.ownerName} · ${profile.city}` : vendor?.email || ""}

        breadcrumbs={[

          { label: "Admin", href: "/admin" },

          { label: "Vendors", href: "/admin/vendors" },

          { label: profile?.businessName || vendor?.email || "Vendor" },

        ]}

        actions={

          <div className="flex items-center gap-2">

            {vendor?.accountStatus === "pending" && (

              <Button

                onClick={approve}

                disabled={!canApprove || approving}

                className="bg-success hover:bg-success/90 text-success-foreground"

              >

                {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve

              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={rejecting}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setActionType("reject"); setRejectOpen(true); }}>
                  <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setActionType("suspend"); setRejectOpen(true); }}>
                  <ShieldAlert className="mr-2 h-4 w-4 text-warning" /> Suspend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setActionType("ban"); setRejectOpen(true); }}>
                  <Ban className="mr-2 h-4 w-4 text-destructive" /> Ban
                </DropdownMenuItem>
                {(vendor?.accountStatus === "suspended" || vendor?.accountStatus === "banned") && (
                  <DropdownMenuItem onClick={() => { setActionType("reactivate"); setRejectOpen(true); }}>
                    <RotateCcw className="mr-2 h-4 w-4 text-success" /> Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => navigate("/admin/vendors")}>

              <ChevronLeft className="mr-2 h-4 w-4" /> Back

            </Button>

          </div>

        }

      />



      <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-start gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-soft text-primary">

              <Building2 className="h-5 w-5" />

            </div>

            <div>

              <p className="text-lg font-semibold">{profile?.businessName || vendor?.email}</p>

              <p className="text-sm text-muted-foreground">{profile?.ownerName || ""} · {vendor?.email}</p>

            </div>

          </div>

          <StatusBadge status={vendor?.accountStatus as "pending" | "approved" | "rejected" | "under_review"} />

        </div>

      </Card>



      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-4">

        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg p-1">

          <TabsTrigger value="profile">Profile</TabsTrigger>

          <TabsTrigger value="docs">Docs</TabsTrigger>

          <TabsTrigger value="bank">Bank</TabsTrigger>

          <TabsTrigger value="areas">Areas</TabsTrigger>

          <TabsTrigger value="products">Products</TabsTrigger>

        </TabsList>



        <TabsContent value="profile">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            {profile ? (

              <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">

                <Detail label="Business" value={profile.businessName} />

                <Detail label="Owner" value={profile.ownerName} />

                <Detail label="Phone" value={profile.supportPhone} icon={<Phone className="h-3.5 w-3.5" />} />

                <Detail label="GSTIN" value={profile.gstNumber || "Not provided"} />

                <Detail label="City" value={profile.city} />

                <Detail label="Pincode" value={profile.postalCode} />

                <Detail label="Address" value={profile.addressLine1} />

                <Detail label="State" value={profile.state} />

                <Detail label="Category" value="Equipment Rental" />

              </div>

            ) : (

              <div className="py-8 text-center text-muted-foreground text-sm">No profile data available</div>

            )}

          </Card>

        </TabsContent>



        <TabsContent value="docs">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="mb-4 flex items-center justify-between">

              <h3 className="font-semibold">Documents</h3>

              <p className="text-xs text-muted-foreground">{documents.length} uploaded</p>

            </div>

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
                      {d.verificationStatus !== "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void verifyDocumentItem(d.id, "approved")}
                          className="h-8 w-8"
                          aria-label="Approve document"
                          disabled={itemActionLoadingKey !== null}
                        >
                          {itemActionLoadingKey === `doc-${d.id}-approved` ? (
                            <Loader2 className="h-4 w-4 animate-spin text-success" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </Button>
                      )}
                      {d.verificationStatus !== "rejected" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openItemRejectDialog("doc", d.id)}
                          className="h-8 w-8"
                          aria-label="Reject document"
                          disabled={itemActionLoadingKey !== null}
                        >
                          {itemActionLoadingKey === `doc-${d.id}-rejected` ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => previewDoc(d.fileUrl, d.documentType)}
                        className="h-8 w-8"
                        aria-label="Preview document"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
                      {d.verificationStatus !== "approved" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void verifyDocumentItem(d.id, "approved")}
                          className="h-8 px-1 text-[10px]"
                          disabled={itemActionLoadingKey !== null}
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
                      {d.verificationStatus !== "rejected" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openItemRejectDialog("doc", d.id)}
                          className="h-8 px-1 text-[10px]"
                          disabled={itemActionLoadingKey !== null}
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
                        onClick={() => previewDoc(d.fileUrl, d.documentType)}
                        className="h-8 px-1 text-[10px]"
                      >
                        <Eye className="h-3 w-3" />
                        <span className="ml-1">Preview</span>
                      </Button>
                    </div>
                  </div>
                </div>

              ))}

              {documents.length === 0 && (

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">

                  No documents uploaded.

                </div>

              )}

            </div>

          </Card>

        </TabsContent>



        <TabsContent value="bank">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            {bankAccounts.length > 0 ? (

              <>

                <div className="space-y-2">
                  {bankAccounts.map((bank) => (
                    <div key={bank.id} className="rounded-lg border border-border p-3">
                      {/* Desktop: full details with icon buttons */}
                      <div className="hidden sm:block">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <Detail label="Account holder" value={bank.accountHolderName} />
                          <Detail label="Bank" value={bank.bankName} />
                          <Detail label="Account number" value={bank.accountNumber} />
                          <Detail label="IFSC" value={bank.ifscCode} />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-xs font-medium text-success">
                            <ShieldCheck className="h-4 w-4" /> Bank verification {bank.verificationStatus.replace("_", " ")}
                          </div>
                          <div className="flex items-center gap-1">
                            {bank.verificationStatus !== "approved" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void verifyBankItem(bank.id, "approved")}
                                className="h-8 w-8"
                                aria-label="Approve bank account"
                                disabled={itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${bank.id}-approved` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-success" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                )}
                              </Button>
                            )}
                            {bank.verificationStatus !== "rejected" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openItemRejectDialog("bank", bank.id)}
                                className="h-8 w-8"
                                aria-label="Reject bank account"
                                disabled={itemActionLoadingKey !== null}
                              >
                                {itemActionLoadingKey === `bank-${bank.id}-rejected` ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Mobile: compact layout with labeled buttons */}
                      <div className="sm:hidden">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <p className="text-sm font-medium leading-tight flex-1">{bank.bankName}</p>
                              <StatusBadge status={bank.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} className="text-[10px] px-2 py-0.5 shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{bank.accountHolderName}</p>
                            <p className="text-xs text-muted-foreground">···{bank.accountNumber.slice(-4)}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {bank.verificationStatus !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void verifyBankItem(bank.id, "approved")}
                              className="h-8 px-1 text-[10px]"
                              disabled={itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `bank-${bank.id}-approved` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-success" />
                              )}
                              <span className="ml-1">Approve</span>
                            </Button>
                          )}
                          {bank.verificationStatus !== "rejected" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openItemRejectDialog("bank", bank.id)}
                              className="h-8 px-1 text-[10px]"
                              disabled={itemActionLoadingKey !== null}
                            >
                              {itemActionLoadingKey === `bank-${bank.id}-rejected` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3 text-destructive" />
                              )}
                              <span className="ml-1">Reject</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </>

            ) : (

              <div className="py-8 text-center text-muted-foreground text-sm">No bank account details available</div>

            )}

          </Card>

        </TabsContent>



        <TabsContent value="areas">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {serviceAreas.map((area) => (

                <div key={area.id} className="rounded-lg border border-border p-3">

                  <p className="text-sm font-medium">{area.areaName}</p>

                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">

                    <MapPin className="h-3.5 w-3.5" /> {area.city} · {area.serviceRadiusKm} km radius

                  </p>

                </div>

              ))}

              {serviceAreas.length === 0 && (

                <div className="col-span-full py-8 text-center text-muted-foreground text-sm">No service areas defined</div>

              )}

            </div>

          </Card>

        </TabsContent>



        <TabsContent value="products">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="mb-4 flex items-center justify-between">

              <h3 className="font-semibold">Listings</h3>

              <p className="text-xs text-muted-foreground">{productListings.length} total</p>

            </div>

            <div className="space-y-2">

              {productListings.map((p) => (

                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">

                  <div className="flex items-center gap-2">

                    <Package className="h-4 w-4 text-primary" />

                    <div>

                      <p className="text-sm font-medium">{p.listingTitle}</p>

                      <p className="text-xs text-muted-foreground">Daily: ₹{p.dailyRent}</p>

                    </div>

                  </div>

                  <p className="text-sm font-mono">Qty {p.availableQuantity}</p>

                </div>

              ))}

              {productListings.length === 0 && (

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">

                  No listings published yet.

                </div>

              )}

            </div>

          </Card>

        </TabsContent>

      </Tabs>



      <Dialog open={itemRejectOpen} onOpenChange={setItemRejectOpen}>

        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">

          <DialogHeader>

            <DialogTitle>Reject {itemRejectTarget?.kind === "bank" ? "bank account" : "document"}</DialogTitle>

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

            <Button variant="outline" onClick={() => setItemRejectOpen(false)} disabled={itemActionLoadingKey !== null} className="w-full sm:w-auto">Cancel</Button>

            <Button variant="destructive" onClick={() => void submitItemReject()} disabled={itemActionLoadingKey !== null || !itemRejectTarget} className="w-full sm:w-auto">

              {itemActionLoadingKey !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reject

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>

        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">

          <DialogHeader>

            <DialogTitle>{actionType === "reject" ? "Reject Vendor" : actionType === "suspend" ? "Suspend Vendor" : actionType === "ban" ? "Ban Vendor" : "Reactivate Vendor"}</DialogTitle>

          </DialogHeader>

          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">

            <div className="space-y-1.5">

              <Label>{actionType === "reject" ? "Why is this vendor being rejected?" : actionType === "suspend" ? "Why is this vendor being suspended?" : actionType === "ban" ? "Why is this vendor being banned?" : "Why is this vendor being reactivated?"}</Label>

              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Provide clear feedback so the vendor can fix the issue…" rows={5} />

            </div>

            <div className="h-5" />

          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">

            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting} className="w-full sm:w-auto">Cancel</Button>

            <Button variant={actionType === "reactivate" ? "default" : "destructive"} onClick={handleAction} disabled={rejecting} className="w-full sm:w-auto">

              {rejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm {actionType}

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

    </div>

  );

};



const Detail = ({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) => (

  <div>

    <p className="mb-1 text-xs text-muted-foreground">{label}</p>

    <p className="inline-flex items-center gap-1.5 font-medium">

      {icon}

      {value}

    </p>

  </div>

);



export default VendorDetails;





