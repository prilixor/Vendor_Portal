import { ReactNode, useState, useEffect } from "react";

import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/app/components/shared/PageHeader";

import { Card } from "@/app/components/ui/card";

import { Button } from "@/app/components/ui/button";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

import { StatusBadge } from "@/app/components/shared/StatusBadge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";

import { Label } from "@/app/components/ui/label";

import { Textarea } from "@/app/components/ui/textarea";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";

import { adminApi, VendorDto, VendorProfileDto, VendorDocumentDto, VendorBankAccountDto, VendorServiceAreaDto, VendorWorkingHourDto, VendorProductListingDto } from "@/app/services/adminApi";

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



const dayLabel: Record<string, string> = {

  mon: "Monday",

  tue: "Tuesday",

  wed: "Wednesday",

  thu: "Thursday",

  fri: "Friday",

  sat: "Saturday",

  sun: "Sunday",

};



const vendorTabs = ["profile", "docs", "bank", "areas", "hours", "products"] as const;

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

  const [vendor, setVendor] = useState<VendorDto | null>(null);

  const [profile, setProfile] = useState<VendorProfileDto | null>(null);

  const [documents, setDocuments] = useState<VendorDocumentDto[]>([]);

  const [bankAccounts, setBankAccounts] = useState<VendorBankAccountDto[]>([]);

  const [serviceAreas, setServiceAreas] = useState<VendorServiceAreaDto[]>([]);

  const [workingHours, setWorkingHours] = useState<VendorWorkingHourDto[]>([]);

  const [productListings, setProductListings] = useState<VendorProductListingDto[]>([]);



  useEffect(() => {

    if (!vendorId) return;

    loadVendorData(vendorId);

  }, [vendorId]);

  // Auto-refresh vendor data every 10 seconds
  useEffect(() => {
    if (!vendorId) return;

    const interval = setInterval(() => {
      loadVendorData(vendorId);
    }, 10000);

    return () => clearInterval(interval);
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

      const [profileData, docsData, bankData, areasData, hoursData, listingsData] = await Promise.all([

        adminApi.getVendorProfile(id).catch(() => null),

        adminApi.getVendorDocuments(id).catch(() => []),

        adminApi.getVendorBankAccounts(id).catch(() => []),

        adminApi.getVendorServiceAreas(id).catch(() => []),

        adminApi.getVendorWorkingHours(id).catch(() => []),

        adminApi.getVendorProductListings(id).catch(() => []),

      ]);



      setProfile(profileData);

      setDocuments(docsData);

      setBankAccounts(bankData);

      setServiceAreas(areasData);

      setWorkingHours(hoursData);

      setProductListings(listingsData);

    } catch (error) {

      const message = error instanceof Error ? error.message : "Failed to load vendor details.";

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

      <div className="flex items-center justify-center py-12">

        <Loader2 className="h-8 w-8 animate-spin text-primary" />

      </div>

    );

  }



  const activeDays = workingHours.filter((d) => d.isOpen).length;

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

      const message = error instanceof Error ? error.message : "Failed to approve vendor.";

      toast.error(message);

    } finally {

      setApproving(false);

    }

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

      const message = error instanceof Error ? error.message : "Failed to reject vendor.";

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
      const message = error instanceof Error ? error.message : "Failed to suspend vendor.";
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
      const message = error instanceof Error ? error.message : "Failed to ban vendor.";
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
      const message = error instanceof Error ? error.message : "Failed to reactivate vendor.";
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

          <TabsTrigger value="hours">Hours</TabsTrigger>

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

              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{documents.length} uploaded</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => vendorId && loadVendorData(vendorId)}
                  className="h-7 w-7"
                  aria-label="Refresh documents"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

            </div>

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

                  <StatusBadge status={d.verificationStatus as "pending" | "approved" | "rejected" | "under_review"} />

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

                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">

                  <Detail label="Account holder" value={bankAccounts[0].accountHolderName} />

                  <Detail label="Bank" value={bankAccounts[0].bankName} />

                  <Detail label="Account number" value={`••••${bankAccounts[0].accountNumber.slice(-4)}`} />

                  <Detail label="IFSC" value={bankAccounts[0].ifscCode} />

                </div>

                <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-xs font-medium text-success">

                  <ShieldCheck className="h-4 w-4" /> Bank verification {bankAccounts[0].verificationStatus.replace("_", " ")}

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



        <TabsContent value="hours">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">

              Open on {activeDays} of 7 days

            </div>

            <div className="space-y-2">

              {workingHours.map((h) => (

                <div key={h.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">

                  <span className="font-medium">{dayLabel[["mon", "tue", "wed", "thu", "fri", "sat", "sun"][h.dayOfWeek - 1]] || `Day ${h.dayOfWeek}`}</span>

                  {h.isOpen ? (

                    <span className="inline-flex items-center gap-1 text-muted-foreground">

                      <Clock3 className="h-3.5 w-3.5" /> {h.openTime} - {h.closeTime}

                    </span>

                  ) : (

                    <span className="inline-flex items-center gap-1 text-muted-foreground">

                      <CircleOff className="h-3.5 w-3.5" /> Closed

                    </span>

                  )}

                </div>

              ))}

              {workingHours.length === 0 && (

                <div className="py-8 text-center text-muted-foreground text-sm">No working hours defined</div>

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



      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>

        <DialogContent>

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

          <DialogFooter>

            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={rejecting}>Cancel</Button>

            <Button variant={actionType === "reactivate" ? "default" : "destructive"} onClick={handleAction} disabled={rejecting}>

              {rejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm {actionType}

            </Button>

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





