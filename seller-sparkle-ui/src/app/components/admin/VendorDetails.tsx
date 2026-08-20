import { ReactNode, useState, useEffect, useMemo } from "react";

import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { PageHeader } from "@/app/components/shared/PageHeader";

import { Card } from "@/app/components/ui/card";

import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ListPager } from "@/app/components/shared/ListPager";

import { Button } from "@/app/components/ui/button";

import { Switch } from "@/app/components/ui/switch";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, IconTooltip } from "@/app/components/ui/tooltip";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";

import { StatusBadge } from "@/app/components/shared/StatusBadge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";

import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";

import { Textarea } from "@/app/components/ui/textarea";

import { Badge } from "@/app/components/ui/badge";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";

import { adminApi, VendorDto, VendorProfileDto, VendorDocumentDto, VendorBankAccountDto, VendorServiceAreaDto, VendorWorkingHourDto, VendorProductListingDto, ProductDto } from "@/app/services/adminApi";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { ListingThumb } from "@/app/components/shared/ListingThumb";
import { retryOriginalOnImageError, resolveCatalogProductImageUrl, resolveItemImageUrl } from "@/app/helpers/utils";

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
  ChevronDown,
  Search,
  CircleOff,
  Clock3,
  FileText,
  FlaskConical,
  Heart,
  MapPin,
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
  LogIn,
} from "lucide-react";

import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { getVendorPortalHref } from "@/app/helpers/portalHost";
import { useAuth } from "@/app/guards/AuthContext";
import { ADMIN_PERMISSIONS } from "@/app/helpers/adminNav";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { AdminServiceAreaRadiusDialog } from "@/app/components/admin/AdminServiceAreaRadiusDialog";


const dayLabel: Record<number, string> = {

  0: "Monday",

  1: "Tuesday",

  2: "Wednesday",

  3: "Thursday",

  4: "Friday",

  5: "Saturday",

  6: "Sunday",

};


const LISTING_PAGE_SIZE = 8;

const vendorTabs = ["profile", "docs", "bank", "areas", "products", "chemicals"] as const;

type VendorTab = (typeof vendorTabs)[number];

function filterVendorListings(
  listings: VendorProductListingDto[],
  isChemical: boolean,
  favoritesOnly: boolean,
  search: string,
): VendorProductListingDto[] {
  const q = search.trim().toLowerCase();
  return listings.filter((p) => {
    if (Boolean(p.isChemical) !== isChemical) return false;
    if (favoritesOnly && !(p.favoriteCount > 0)) return false;
    if (!q) return true;
    return (
      p.listingTitle.toLowerCase().includes(q) ||
      (p.listingStatus ?? "").replace(/_/g, " ").toLowerCase().includes(q)
    );
  });
}

type ChemSize = { sizeValue: number; sizeUnit: string; buyPrice: number };

/**
 * Chemical price shown as a tap/click disclosure (works on touch + mouse, unlike a hover
 * tooltip). Shows the buy-price range and expands to the full per-size breakdown, which
 * scrolls when a chemical has many packaging sizes.
 */
const ChemPriceDisclosure = ({ label, count, sizes }: { label: string; count: number; sizes: ChemSize[] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-foreground"
      >
        <span>{label}</span>
        <span className="font-normal text-muted-foreground">
          · {count} {count === 1 ? "size" : "sizes"}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1 max-h-52 w-full max-w-[16rem] divide-y divide-border/40 overflow-auto rounded-md border border-border/60">
          {sizes.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-6 px-2.5 py-1 text-xs">
              <span className="text-muted-foreground">
                {v.sizeValue} {v.sizeUnit}
              </span>
              <span className="font-medium tabular-nums">₹{v.buyPrice.toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type ChemStockSize = { label: string; sku: string; total: number; available: number };

/** Collapsed by default so many packaging sizes do not stretch the listing row. */
const ChemStockDisclosure = ({
  total,
  available,
  sizes,
}: {
  total: number;
  available: number;
  sizes: ChemStockSize[];
}) => {
  const [open, setOpen] = useState(false);
  const count = sizes.length;
  return (
    <div className="text-right">
      <p className="text-sm font-mono font-medium">Qty {total}</p>
      <p className="text-[10px] text-muted-foreground">{available} available</p>
      {count > 0 && (
        <div className="mt-0.5 flex flex-col items-end">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            <span>
              {count} {count === 1 ? "size" : "sizes"}
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="mt-1 max-h-40 w-full min-w-[9rem] max-w-[12rem] divide-y divide-border/40 overflow-auto rounded-md border border-border/60 text-left">
              {sizes.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-2 py-1 text-[10px]">
                  <span className="text-muted-foreground truncate" title={s.sku}>
                    {s.label}
                  </span>
                  <span className="font-mono tabular-nums font-medium shrink-0">
                    {s.total}
                    {s.available !== s.total ? (
                      <span className="text-muted-foreground font-normal"> · {s.available}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const listingStatusLabel = (status?: string) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "Inactive";

const ListingQty = ({ total, available }: { total: number; available?: number }) => (
  <>
    <p className="text-sm font-mono font-semibold tabular-nums">Qty {total}</p>
    {available !== undefined && (
      <p className="text-[10px] leading-4 text-muted-foreground">{available} available</p>
    )}
  </>
);

const VendorListingCard = ({
  listing,
  catalogImages,
  price,
  qty,
}: {
  listing: VendorProductListingDto;
  catalogImages?: ProductDto["images"];
  price: ReactNode;
  qty: ReactNode;
}) => {
  const src = resolveItemImageUrl({
    primaryImageUrl: listing.primaryImageUrl,
    primaryThumbnailUrl: listing.primaryThumbnailUrl,
  });
  const catalogSrc = resolveCatalogProductImageUrl(catalogImages);
  const isActive = listing.listingStatus === "active" || listing.listingStatus === "approved";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3">
      <ListingThumb
        src={src}
        fallbackSrc={catalogSrc}
        alt={listing.listingTitle}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 [overflow-wrap:anywhere]">
          {listing.listingTitle}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {isActive ? (
            <Badge variant="outline" className="h-4 border-success bg-success/10 px-1.5 py-0 text-[10px] font-medium leading-none text-success">
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="h-4 border-muted-foreground/30 bg-muted/50 px-1.5 py-0 text-[10px] font-medium leading-none text-muted-foreground">
              {listingStatusLabel(listing.listingStatus)}
            </Badge>
          )}
          {listing.favoriteCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-default items-center gap-0.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0 text-[10px] font-medium leading-4 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                    <Heart className="h-2.5 w-2.5 fill-current" />
                    {listing.favoriteCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    Favorited by {listing.favoriteCount}{" "}
                    {listing.favoriteCount === 1 ? "customer" : "customers"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="mt-1 min-w-0">{price}</div>
      </div>
      <div className="shrink-0 text-right">{qty}</div>
    </div>
  );
};

const VendorDetails = () => {

  const { vendorId } = useParams();

  const navigate = useNavigate();

  const { hasPermission } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);

  const [approving, setApproving] = useState(false);

  const [impersonating, setImpersonating] = useState(false);

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
  const [radiusEditArea, setRadiusEditArea] = useState<VendorServiceAreaDto | null>(null);

  const [productListings, setProductListings] = useState<VendorProductListingDto[]>([]);
  const [productMap, setProductMap] = useState<Record<string, ProductDto>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [chemicalSearch, setChemicalSearch] = useState("");
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [chemicalPage, setChemicalPage] = useState(1);
  const [inventoryMap, setInventoryMap] = useState<Record<string, any>>({});
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);



  useEffect(() => {

    if (!vendorId) return;

    loadVendorData(vendorId);

  }, [vendorId]);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get("editRadius") !== "1") return;
    if (serviceAreas.length === 0) return;

    if (searchParams.get("tab") !== "areas") {
      setSearchParams({ tab: "areas", editRadius: "1" }, { replace: true });
      return;
    }

    const pending = serviceAreas.find((a) => !a.isRadiusSetByAdmin) ?? serviceAreas[0];
    if (pending) setRadiusEditArea(pending);

    const next = new URLSearchParams(searchParams);
    next.delete("editRadius");
    setSearchParams(next, { replace: true });
  }, [loading, serviceAreas, searchParams, setSearchParams]);

  useEffect(() => {
    setEquipmentPage(1);
    setChemicalPage(1);
  }, [showFavoritesOnly]);

  useEffect(() => {
    setEquipmentPage(1);
  }, [equipmentSearch]);

  useEffect(() => {
    setChemicalPage(1);
  }, [chemicalSearch]);

  const equipmentListings = useMemo(
    () => filterVendorListings(productListings, false, showFavoritesOnly, equipmentSearch),
    [productListings, showFavoritesOnly, equipmentSearch],
  );
  const chemicalListings = useMemo(
    () => filterVendorListings(productListings, true, showFavoritesOnly, chemicalSearch),
    [productListings, showFavoritesOnly, chemicalSearch],
  );

  const equipmentTotalPages = Math.max(1, Math.ceil(equipmentListings.length / LISTING_PAGE_SIZE));
  const chemicalTotalPages = Math.max(1, Math.ceil(chemicalListings.length / LISTING_PAGE_SIZE));
  const safeEquipmentPage = Math.min(equipmentPage, equipmentTotalPages);
  const safeChemicalPage = Math.min(chemicalPage, chemicalTotalPages);
  const equipmentPageItems = useMemo(
    () => equipmentListings.slice((safeEquipmentPage - 1) * LISTING_PAGE_SIZE, safeEquipmentPage * LISTING_PAGE_SIZE),
    [equipmentListings, safeEquipmentPage],
  );
  const chemicalPageItems = useMemo(
    () => chemicalListings.slice((safeChemicalPage - 1) * LISTING_PAGE_SIZE, safeChemicalPage * LISTING_PAGE_SIZE),
    [chemicalListings, safeChemicalPage],
  );

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



      const sortedListings = listingsData.sort((a, b) => a.listingTitle.localeCompare(b.listingTitle));
      setProductListings(sortedListings);

      // Load catalog products (with per-size variants) so chemical listings can show pricing.
      let productsById: Record<string, ProductDto> = {};
      try {
        const productsData = await adminApi.getProducts();
        const map: Record<string, ProductDto> = {};
        productsData.forEach((prod) => { map[prod.id] = prod; });
        productsById = map;
        setProductMap(map);
      } catch {
        setProductMap({});
      }

      // Fetch inventory for each listing.
      // Chemicals: packaging-size (variant) stock is authoritative — same as Vendor Inventory.
      // Equipment: flat VendorInventory.
      const inventoryData: Record<string, {
        totalQuantity: number;
        availableQuantity: number;
        reservedQuantity?: number;
        sizes?: { label: string; sku: string; total: number; available: number }[];
        source: "variant" | "flat";
      }> = {};
      await Promise.all(
        sortedListings.map(async (l) => {
          try {
            const catalogProduct = productsById[l.productId];
            const isChemical = !!(
              l.isChemical ||
              catalogProduct?.baseUnit ||
              catalogProduct?.casNumber ||
              catalogProduct?.chemicalFormula ||
              (catalogProduct?.variants && catalogProduct.variants.length > 0)
            );

            if (isChemical) {
              const variantRows = await vendorOnboardingApi.getVariantInventory(id, l.id).catch(() => []);
              if (variantRows.length > 0) {
                inventoryData[l.id] = {
                  totalQuantity: variantRows.reduce((sum, r) => sum + (r.totalQuantity || 0), 0),
                  availableQuantity: variantRows.reduce((sum, r) => sum + (r.availableQuantity || 0), 0),
                  reservedQuantity: variantRows.reduce((sum, r) => sum + (r.reservedQuantity || 0), 0),
                  sizes: variantRows.map((r) => ({
                    label: `${r.sizeValue} ${r.sizeUnit}`,
                    sku: r.sku,
                    total: r.totalQuantity || 0,
                    available: r.availableQuantity || 0,
                  })),
                  source: "variant",
                };
                return;
              }
            }

            const inv = await vendorOnboardingApi.getVendorInventory(id, l.id);
            if (inv) {
              inventoryData[l.id] = {
                totalQuantity: inv.totalQuantity,
                availableQuantity: inv.availableQuantity,
                reservedQuantity: inv.reservedQuantity,
                source: "flat",
              };
            }
          } catch {
            // ignore if no inventory
          }
        })
      );
      setInventoryMap(inventoryData);

    } catch (error) {
      const message = getUserFriendlyMessage(error);

      toast.error(message);

    } finally {

      setLoading(false);

    }

  };

  // Chemicals are priced per packaging size; derive the customer buy-price range + sorted sizes.
  const getChemPricing = (productId: string) => {
    const product = productMap[productId];
    const active = (product?.variants || []).filter(
      (v) => v.isActive !== false && typeof v.buyPrice === "number" && v.buyPrice > 0
    );
    if (active.length === 0) return null;
    const prices = active.map((v) => v.buyPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const label =
      min === max
        ? `₹${min.toLocaleString("en-IN")}`
        : `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`;
    const sizes = active.slice().sort((a, b) => (a.sizeValue ?? 0) - (b.sizeValue ?? 0));
    return { label, sizes, count: active.length };
  };

  const renderListingPrice = (listing: VendorProductListingDto) => {
    if (listing.isChemical) {
      const pricing = getChemPricing(listing.productId);
      if (!pricing) {
        return <p className="text-xs text-muted-foreground">Price not set</p>;
      }
      return <ChemPriceDisclosure label={pricing.label} count={pricing.count} sizes={pricing.sizes} />;
    }
    return <p className="text-xs text-muted-foreground">Daily rate: ₹{listing.dailyRent ?? 0}</p>;
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
    return <PageLoaderSlot />;
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

  const canSetServiceRadius = hasPermission(ADMIN_PERMISSIONS.vendorsVerify);

  const openRadiusEditor = (area: VendorServiceAreaDto) => {
    setRadiusEditArea(area);
  };

  const serviceAreasNeedRadiusReview =
    serviceAreas.length === 0 || serviceAreas.some((a) => !a.isRadiusSetByAdmin);

  const canApprove = vendor?.accountStatus === "pending" &&

    documents.length > 0 && documents.every(d => d.verificationStatus === "approved") &&

    bankAccounts.length > 0 && bankAccounts.some(b => b.verificationStatus === "approved") &&

    serviceAreas.length > 0 && serviceAreas.every((a) => a.isRadiusSetByAdmin);



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

          <div className="flex w-full min-w-0 flex-col gap-2 [text-size-adjust:100%]">

            {vendor?.accountStatus === "pending" && (
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <Button
                  onClick={approve}
                  disabled={!canApprove || approving}
                  size="sm"
                  className="h-9 bg-success hover:bg-success/90 text-success-foreground"
                >
                  {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
                </Button>
                {serviceAreasNeedRadiusReview && (
                  <p className="max-w-xs text-[11px] text-amber-700 dark:text-amber-300 sm:text-right">
                    {serviceAreas.length === 0
                      ? "Add/set service area radius on the Areas tab before approval."
                      : "Set coverage radius for all service areas (Areas tab) before approval."}
                  </p>
                )}
              </div>
            )}
            <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 sm:w-auto sm:gap-2">
            {hasPermission(ADMIN_PERMISSIONS.vendorsImpersonate) && vendorId && (
              <Button
                variant="secondary"
                className="h-9 w-auto shrink-0 whitespace-nowrap px-2.5 text-xs sm:h-10 sm:px-4 sm:text-sm"
                disabled={impersonating}
                onClick={async () => {
                  setImpersonating(true);
                  try {
                    const result = await adminApi.impersonateVendor(vendorId);
                    const href = getVendorPortalHref(`/impersonation/consume?code=${encodeURIComponent(result.exchangeCode)}`);
                    window.open(href, "_blank", "noopener,noreferrer");
                    toast.success(`Opened ${result.vendorName} in a new tab. Your admin session stays here.`);
                  } catch (e) {
                    toast.error(getUserFriendlyMessage(e));
                  } finally {
                    setImpersonating(false);
                  }
                }}
              >
                {impersonating ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin sm:mr-2" /> : <LogIn className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />}
                Open as Vendor
              </Button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" disabled={rejecting} aria-label="More actions">
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

            <Button variant="outline" className="h-9 shrink-0 whitespace-nowrap px-2.5 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={() => navigate("/admin/vendors")}>
              <ChevronLeft className="mr-1 h-4 w-4 sm:mr-2" /> Back
            </Button>
            </div>
            </div>

          </div>

        }

      />



      <Card className="border-border/60 p-3 sm:p-5 lg:p-6">

        <div className="flex items-start gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-soft text-primary sm:h-12 sm:w-12">

            <Building2 className="h-5 w-5" />

          </div>

          <div className="min-w-0 flex-1">

            <div className="flex items-start justify-between gap-2">

              <p className="min-w-0 text-base font-semibold leading-snug sm:text-lg">{profile?.businessName || vendor?.email}</p>

              <StatusBadge status={vendor?.accountStatus as "pending" | "approved" | "rejected" | "under_review"} className="shrink-0" />

            </div>

            {profile?.ownerName ? (
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{profile.ownerName}</p>
            ) : null}

            {vendor?.email ? (
              <CopyableEmail
                email={vendor.email}
                truncate={false}
                className="mt-0.5 w-full"
                textClassName="text-xs sm:text-sm"
              />
            ) : null}

          </div>

        </div>

      </Card>



      <Tabs value={activeTab} onValueChange={onTabChange} className="mt-3">

        <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto rounded-lg p-1">

          <TabsTrigger value="profile" className="shrink-0">Profile</TabsTrigger>

          <TabsTrigger value="docs" className="shrink-0">Docs</TabsTrigger>

          <TabsTrigger value="bank" className="shrink-0">Bank</TabsTrigger>

          <TabsTrigger value="areas" className="shrink-0 gap-1.5">
            Areas
            {serviceAreas.some((a) => !a.isRadiusSetByAdmin) && (
              <Badge
                variant="outline"
                className="h-4 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] font-medium text-amber-800 dark:text-amber-200"
              >
                Review
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="products" className="shrink-0">Equipment</TabsTrigger>

          <TabsTrigger value="chemicals" className="shrink-0">Chemicals</TabsTrigger>

        </TabsList>



        <TabsContent value="profile">

          <Card className="border-border/60 p-3 sm:p-5 lg:p-6">

            {profile ? (

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:gap-5 lg:grid-cols-3">

                <Detail label="Business" value={profile.businessName} />

                <Detail label="Owner" value={profile.ownerName} />

                <Detail label="Phone" value={profile.supportPhone} icon={<Phone className="h-3.5 w-3.5" />} />

                <Detail label="GSTIN" value={profile.gstNumber || "Not provided"} />

                <Detail label="City" value={profile.city} />

                <Detail label="Pincode" value={profile.postalCode} />

                <Detail label="Address" value={profile.addressLine1} className="col-span-2 lg:col-span-1" />

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
                        <IconTooltip label="Approve document">
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
                        </IconTooltip>
                      )}
                      {d.verificationStatus !== "rejected" && (
                        <IconTooltip label="Reject document">
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
                        </IconTooltip>
                      )}
                      <IconTooltip label="Preview document">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => previewDoc(d.fileUrl, d.documentType)}
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
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {d.verificationStatus !== "approved" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void verifyDocumentItem(d.id, "approved")}
                          className="h-8 px-2 text-xs"
                          disabled={itemActionLoadingKey !== null}
                        >
                          {itemActionLoadingKey === `doc-${d.id}-approved` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          )}
                          <span className="ml-1">Approve</span>
                        </Button>
                      ) : null}
                      {d.verificationStatus !== "rejected" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openItemRejectDialog("doc", d.id)}
                          className="h-8 px-2 text-xs"
                          disabled={itemActionLoadingKey !== null}
                        >
                          {itemActionLoadingKey === `doc-${d.id}-rejected` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          <span className="ml-1">Reject</span>
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => previewDoc(d.fileUrl, d.documentType)}
                        className="h-8 px-2 text-xs"
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
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
                        <Detail label="Account holder" value={bank.accountHolderName} />
                        <Detail label="Bank" value={bank.bankName} />
                        <Detail label="Account number" value={bank.accountNumber} />
                        <Detail label="IFSC" value={bank.ifscCode} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="inline-flex min-w-0 items-center gap-2 rounded-md bg-success-soft px-2.5 py-1.5 text-xs font-medium text-success sm:px-3 sm:py-2">
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          <span className="truncate">Bank verification {bank.verificationStatus.replace("_", " ")}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {bank.verificationStatus !== "approved" && (
                            <IconTooltip label="Approve bank account">
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
                            </IconTooltip>
                          )}
                          {bank.verificationStatus !== "rejected" && (
                            <IconTooltip label="Reject bank account">
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
                            </IconTooltip>
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
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">Service areas</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Review the vendor pin location, then set the coverage radius (e.g. 15, 30, or 100 km).
                  Vendor approval stays blocked until every area has an Admin-set radius.
                </p>
              </div>
              {serviceAreas.some((a) => !a.isRadiusSetByAdmin) && (
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                  Needs Admin review
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {serviceAreas.map((area) => (

                <div
                  key={area.id}
                  className={`overflow-hidden rounded-lg border ${
                    area.isRadiusSetByAdmin ? "border-border" : "border-amber-500/40"
                  }`}
                >
                  <div className="bg-muted/20 p-1">
                    <MapPicker
                      latitude={area.centerLatitude}
                      longitude={area.centerLongitude}
                      radiusKm={area.serviceRadiusKm}
                      showRadius
                      height="h-40"
                      radiusReadOnlyLabel={
                        area.isRadiusSetByAdmin
                          ? `${area.serviceRadiusKm} km coverage (set by Admin)`
                          : `Default ${area.serviceRadiusKm} km — Needs Admin review`
                      }
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{area.areaName}</p>
                        {!area.isRadiusSetByAdmin ? (
                          <>
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-200"
                            >
                              Default radius
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-200"
                            >
                              Needs Admin review
                            </Badge>
                          </>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-success/40 bg-success/10 text-[10px] text-success"
                          >
                            Radius set
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {area.city} · {area.serviceRadiusKm} km radius
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Pin {area.centerLatitude.toFixed(4)}, {area.centerLongitude.toFixed(4)}
                      </p>
                    </div>
                    {canSetServiceRadius && (
                      <Button size="sm" variant={area.isRadiusSetByAdmin ? "outline" : "default"} onClick={() => openRadiusEditor(area)}>
                        {area.isRadiusSetByAdmin ? "Edit radius" : "Set radius"}
                      </Button>
                    )}
                  </div>
                </div>

              ))}

              {serviceAreas.length === 0 && (

                <div className="col-span-full py-8 text-center text-muted-foreground text-sm">No service areas defined</div>

              )}

            </div>

          </Card>

          {vendorId && (
            <AdminServiceAreaRadiusDialog
              vendorId={vendorId}
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

        </TabsContent>



        <TabsContent value="products">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h3 className="font-semibold">Equipment Listings</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id="vendor-favorites-only" checked={showFavoritesOnly} onCheckedChange={setShowFavoritesOnly} />
                  <Label htmlFor="vendor-favorites-only" className="text-sm cursor-pointer whitespace-nowrap">Favorites Only</Label>
                </div>
                <p className="text-xs text-muted-foreground">{equipmentListings.length} total</p>
              </div>
            </div>

            <div className="relative mb-4 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                placeholder="Search equipment"
                className="h-11 rounded-xl pl-9"
                aria-label="Search equipment listings"
              />
            </div>

            <div className="space-y-2.5">
              {equipmentPageItems.map((p) => (
                <VendorListingCard
                  key={p.id}
                  listing={p}
                  catalogImages={productMap[p.productId]?.images}
                  price={renderListingPrice(p)}
                  qty={
                    <ListingQty
                      total={inventoryMap[p.id]?.totalQuantity ?? p.availableQuantity}
                      available={inventoryMap[p.id] ? inventoryMap[p.id].availableQuantity : undefined}
                    />
                  }
                />
              ))}

              {equipmentListings.length === 0 && (

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">

                  {equipmentSearch.trim()
                    ? `No equipment listings match “${equipmentSearch.trim()}”.`
                    : "No equipment listings found."}

                </div>

              )}

            </div>

            {equipmentListings.length > 0 && (
              <ListPager
                className="pt-3"
                page={safeEquipmentPage}
                totalPages={equipmentTotalPages}
                summary={`Page ${safeEquipmentPage} of ${equipmentTotalPages} · ${equipmentListings.length} ${equipmentListings.length === 1 ? "listing" : "listings"}${equipmentSearch.trim().length > 0 ? " matching search" : ""}`}
                onPageChange={setEquipmentPage}
              />
            )}

          </Card>

        </TabsContent>



        <TabsContent value="chemicals">

          <Card className="border-border/60 p-4 sm:p-5 lg:p-6">

            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Chemical Listings</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch id="vendor-chem-favorites-only" checked={showFavoritesOnly} onCheckedChange={setShowFavoritesOnly} />
                  <Label htmlFor="vendor-chem-favorites-only" className="text-sm cursor-pointer whitespace-nowrap">Favorites Only</Label>
                </div>
                <p className="text-xs text-muted-foreground">{chemicalListings.length} total</p>
              </div>
            </div>

            <div className="relative mb-4 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={chemicalSearch}
                onChange={(e) => setChemicalSearch(e.target.value)}
                placeholder="Search chemicals"
                className="h-11 rounded-xl pl-9"
                aria-label="Search chemical listings"
              />
            </div>

            <div className="space-y-2.5">
              {chemicalPageItems.map((p) => (
                <VendorListingCard
                  key={p.id}
                  listing={p}
                  catalogImages={productMap[p.productId]?.images}
                  price={renderListingPrice(p)}
                  qty={
                    inventoryMap[p.id]?.source === "variant" && inventoryMap[p.id]?.sizes && inventoryMap[p.id].sizes!.length > 0 ? (
                      <ChemStockDisclosure
                        total={inventoryMap[p.id].totalQuantity}
                        available={inventoryMap[p.id].availableQuantity}
                        sizes={inventoryMap[p.id].sizes!}
                      />
                    ) : (
                      <ListingQty
                        total={inventoryMap[p.id]?.totalQuantity ?? p.availableQuantity}
                        available={inventoryMap[p.id] ? inventoryMap[p.id].availableQuantity : undefined}
                      />
                    )
                  }
                />
              ))}

              {chemicalListings.length === 0 && (

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">

                  {chemicalSearch.trim()
                    ? `No chemical listings match “${chemicalSearch.trim()}”.`
                    : "No chemical listings found."}

                </div>

              )}

            </div>

            {chemicalListings.length > 0 && (
              <ListPager
                className="pt-3"
                page={safeChemicalPage}
                totalPages={chemicalTotalPages}
                summary={`Page ${safeChemicalPage} of ${chemicalTotalPages} · ${chemicalListings.length} ${chemicalListings.length === 1 ? "listing" : "listings"}${chemicalSearch.trim().length > 0 ? " matching search" : ""}`}
                onPageChange={setChemicalPage}
              />
            )}

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

    </div>

  );

};



const Detail = ({ label, value, icon, className }: { label: string; value: string; icon?: ReactNode; className?: string }) => (

  <div className={["min-w-0", className].filter(Boolean).join(" ")}>

    <p className="mb-0.5 text-[11px] leading-none text-muted-foreground sm:mb-1 sm:text-xs">{label}</p>

    <p className="inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium leading-snug">

      {icon}

      {value}

    </p>

  </div>

);



export default VendorDetails;





