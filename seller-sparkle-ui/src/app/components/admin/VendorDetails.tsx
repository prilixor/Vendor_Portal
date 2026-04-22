import { ReactNode } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { getVendorDocuments } from "@/app/services/vendorDocuments";
import {
  mockBankDetails,
  mockBusinessProfile,
  mockProducts,
  mockServiceAreas,
  mockVendors,
  mockWorkingHours,
} from "@/app/services/mockData";
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
} from "lucide-react";

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
  const vendor = mockVendors.find((v) => v.id === vendorId);

  if (!vendorId) return <Navigate to="/admin/vendors" replace />;
  if (!vendor) {
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

  const documents = getVendorDocuments(vendor.id);
  const productRows = mockProducts.slice(0, vendor.productsCount);
  const activeDays = mockWorkingHours.filter((d) => d.open).length;
  const queryTab = searchParams.get("tab");
  const activeTab: VendorTab = vendorTabs.includes((queryTab ?? "") as VendorTab) ? (queryTab as VendorTab) : "profile";

  const onTabChange = (tab: string) => {
    if (!vendorTabs.includes(tab as VendorTab)) return;
    setSearchParams({ tab });
  };

  return (
    <div>
      <PageHeader
        title={vendor.businessName}
        description={`${vendor.ownerName} · ${vendor.city}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Vendors", href: "/admin/vendors" },
          { label: vendor.businessName },
        ]}
        actions={
          <Button variant="outline" onClick={() => navigate("/admin/vendors")}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />

      <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-soft text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold">{vendor.businessName}</p>
              <p className="text-sm text-muted-foreground">{vendor.ownerName} · {vendor.email}</p>
            </div>
          </div>
          <StatusBadge status={vendor.status} />
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
            <div className="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Business" value={vendor.businessName} />
              <Detail label="Owner" value={vendor.ownerName} />
              <Detail label="Phone" value={mockBusinessProfile.phone} icon={<Phone className="h-3.5 w-3.5" />} />
              <Detail label="GSTIN" value={mockBusinessProfile.gstNumber} />
              <Detail label="City" value={vendor.city} />
              <Detail label="Pincode" value={mockBusinessProfile.postalCode} />
              <Detail label="Address" value={mockBusinessProfile.addressLine1} />
              <Detail label="State" value={mockBusinessProfile.state} />
              <Detail label="Category" value="Equipment Rental" />
            </div>
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
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{d.type}</p>
                      <p className="text-xs text-muted-foreground">{d.fileName}</p>
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
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
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <Detail label="Account holder" value={mockBankDetails.accountHolderName} />
              <Detail label="Bank" value={mockBankDetails.bankName} />
              <Detail label="Account number" value={`••••${mockBankDetails.accountNumber.slice(-4)}`} />
              <Detail label="IFSC" value={mockBankDetails.ifscCode} />
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-xs font-medium text-success">
              <ShieldCheck className="h-4 w-4" /> Bank verification {mockBankDetails.status.replace("_", " ")}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="areas">
          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mockServiceAreas.map((area) => (
                <div key={area.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{area.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {area.city} · {area.radiusKm} km radius
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
            <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Open on {activeDays} of 7 days
            </div>
            <div className="space-y-2">
              {mockWorkingHours.map((h) => (
                <div key={h.day} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span className="font-medium">{dayLabel[h.day]}</span>
                  {h.open ? (
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
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Listings</h3>
              <p className="text-xs text-muted-foreground">{vendor.productsCount} total</p>
            </div>
            <div className="space-y-2">
              {productRows.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                    </div>
                  </div>
                  <p className="text-sm font-mono">Qty {p.quantity}</p>
                </div>
              ))}
              {productRows.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No listings published yet.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
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


