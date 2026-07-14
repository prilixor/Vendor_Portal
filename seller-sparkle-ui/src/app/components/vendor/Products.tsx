import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/app/components/ui/pagination";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { ProductListing } from "@/app/models";
import { Plus, Search, Pencil, Image as ImageIcon, Star, Upload, Trash2, X, Eye, FileText, Loader2, Package, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { apiClient } from "@/app/services/apiClient";
import { vendorOnboardingApi, VendorFileFolderType, VendorVariantInventoryDto } from "@/app/services/vendorOnboardingApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type LocalListing = ProductListing & {
  productId: string;
  categoryId: string;
  buyPrice?: number;
  gstPercent?: number;
  isRentEnabled?: boolean;
  isBuyEnabled?: boolean;
  favoriteCount?: number;
  baseUnit?: string;
  casNumber?: string;
  chemicalFormula?: string;
  isChemical?: boolean;
  variants?: any[];
};

type CatalogCategory = {
  id: string;
  name: string;
  isChemical?: boolean;
};

type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  gstPercent?: number;
  isRentEnabled?: boolean;
  isBuyEnabled?: boolean;
  baseUnit?: string;
  casNumber?: string;
  chemicalFormula?: string;
  variants?: any[];
};

const normalizeListingStatus = (status: string): ProductListing["status"] => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved" || normalized === "active") return "active";
  if (normalized === "inactive" || normalized === "blocked" || normalized === "rejected") return "inactive";
  return "draft";
};

const blankListing = (category?: CatalogCategory, product?: CatalogProduct): LocalListing => ({
  id: "",
  productId: product?.id ?? "",
  categoryId: category?.id ?? "",
  category: category?.name ?? "",
  productName: product?.name ?? "",
  title: "",
  dailyRent: 0,
  monthlyRent: 0,
  securityDeposit: 0,
  buyPrice: product?.buyPrice,
  gstPercent: product?.gstPercent ?? 18,
  isRentEnabled: product?.isRentEnabled ?? true,
  isBuyEnabled: product?.isBuyEnabled ?? true,
  quantity: 1,
  status: "inactive",
  images: [],
  createdAt: new Date().toISOString(),
  baseUnit: product?.baseUnit,
  variants: product?.variants || [],
});

/**
 * Per-size price breakdown for a chemical. Collapses to the first few sizes with a
 * "Show all" toggle so a chemical with many packaging sizes (e.g. 10+) doesn't blow up
 * the mobile card height; when expanded it scrolls instead of growing unbounded.
 */
const ChemSizeBreakdown = ({ sizes }: { sizes: any[] }) => {
  const COLLAPSED_COUNT = 3;
  const [expanded, setExpanded] = useState(false);
  const hasMore = sizes.length > COLLAPSED_COUNT;
  const visible = expanded ? sizes : sizes.slice(0, COLLAPSED_COUNT);
  return (
    <div className="mt-1">
      <div
        className={`divide-y divide-border/40 rounded-md border border-border/60 ${
          expanded ? "max-h-52 overflow-auto" : ""
        }`}
      >
        {visible.map((v: any, i: number) => (
          <div key={i} className="flex items-center justify-between px-2.5 py-1 text-xs">
            <span className="text-muted-foreground">
              {v.sizeValue} {v.sizeUnit}
            </span>
            <span className="font-mono font-medium tabular-nums">
              ₹{Number(v.buyPrice).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : `Show all ${sizes.length} sizes`}
        </button>
      )}
    </div>
  );
};

const Products = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get("status") as "all" | "active" | "inactive") ?? "all";
  
  const [products, setProducts] = useState<LocalListing[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">(
    ["all", "active", "inactive"].includes(initialFilter) ? initialFilter : "all"
  );
  const [activeTab, setActiveTab] = useState<"equipment" | "chemical">("equipment");

  useEffect(() => {
    const s = searchParams.get("status") as "all" | "active" | "inactive";
    if (s && ["all", "active", "inactive"].includes(s)) {
      setFilter(s);
    } else if (!s) {
      setFilter("all");
    }
  }, [searchParams]);

  const handleFilterChange = (v: string) => {
    const val = v as "all" | "active" | "inactive";
    setFilter(val);
    if (val === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", val);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const [editing, setEditing] = useState<LocalListing | null>(null);
  const [mediaFor, setMediaFor] = useState<LocalListing | null>(null);
  const [tempImages, setTempImages] = useState<MediaImage[]>([]);
  const [listingDocuments, setListingDocuments] = useState<ListingDocument[]>([]);
  const [docType, setDocType] = useState("spec_sheet");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductBrand, setNewProductBrand] = useState("");
  const [newProductModel, setNewProductModel] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null);
  const [deleteImageConfirmId, setDeleteImageConfirmId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ id: string; type: string; url: string } | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Variant-level stock for the chemical listing currently being edited
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, showFavoritesOnly, activeTab]);

  const getFileNameFromUrl = (url?: string) => {
    if (!url) return "";
    try {
      const parsed = new URL(url, window.location.origin);
      const name = parsed.pathname.split("/").pop() || "";
      return decodeURIComponent(name);
    } catch {
      const raw = (url.split("/").pop() || "").split("?")[0];
      try { return decodeURIComponent(raw); } catch { return raw; }
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

  const normalizeHostedFileUrl = (fileUrl: string): string => {
    if (!fileUrl || fileUrl.startsWith("data:")) return fileUrl;

    const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!apiBase) return fileUrl;

    try {
      const apiOrigin = new URL(apiBase).origin;

      // Keep absolute external URLs (like S3 presigned URLs) untouched.
      const isAbsolute = /^https?:\/\//i.test(fileUrl);
      if (isAbsolute) {
        const absolute = new URL(fileUrl);
        if (absolute.origin !== apiOrigin) {
          return fileUrl;
        }
      }

      const parsed = new URL(fileUrl, apiOrigin);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return parsed.toString();
    } catch {
      return fileUrl;
    }
  };

  const downloadUrl = async (url?: string) => {
    if (!url) return;
    try {
      const parsed = new URL(url, window.location.origin);
      const filename = decodeURIComponent((parsed.pathname.split('/').pop() || 'file'));
      await apiClient.downloadBlob(`/files/download?url=${encodeURIComponent(url)}`, filename);
    } catch (err) {
      console.error(err);
      toast.error('Download failed.');
    }
  };

  useEffect(() => {
    if (user) {
      vendorOnboardingApi.getVendorStatus(user.id).then(status => {
        setAccountStatus(status.accountStatus);
      }).catch(() => {
        setAccountStatus(null);
      });
    }
  }, [user]);

  const isPending = accountStatus === "pending";
  const [statusConfirmId, setStatusConfirmId] = useState<string | null>(null);
  const [statusConfirmAction, setStatusConfirmAction] = useState<'activate' | 'deactivate' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const isChemicalCatalogProduct = (p: CatalogProduct, cats: CatalogCategory[] = categories) => {
    const category = cats.find((c) => c.id === p.categoryId);
    return !!(category?.isChemical || p.baseUnit || p.casNumber || p.chemicalFormula);
  };

  const isChemicalListing = (p: LocalListing) =>
    !!(p.isChemical || p.baseUnit || p.casNumber || p.chemicalFormula);

  const filtered = products.filter((p) => {
    const isChem = isChemicalListing(p);
    if (activeTab === "equipment" && isChem) return false;
    if (activeTab === "chemical" && !isChem) return false;

    const m = (filter === "all" || p.status === filter);
    const s = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const f = !showFavoritesOnly || (p.favoriteCount && p.favoriteCount > 0);
    return m && s && f;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleListingStatus = async (listing: LocalListing) => {
    if (!user) return;

    const newStatus = listing.status === "active" ? "inactive" : "active";
    setStatusConfirmId(listing.id);
    setStatusConfirmAction(newStatus === "active" ? "activate" : "deactivate");
  };

  const confirmStatusChange = async (id: string, action: 'activate' | 'deactivate') => {
    if (!user) return;

    const listing = products.find(p => p.id === id);
    if (!listing) return;

    try {
      setBusy(true);
      const newStatus = action === "activate" ? "active" : "inactive";
      await vendorOnboardingApi.updateVendorProductListing(user.id, listing.id, {
        vendorId: user.id,
        listingId: listing.id,
        productId: listing.productId,
        listingTitle: listing.title,
        availableQuantity: listing.quantity,
        listingStatus: newStatus,
      });
      setProducts(products.map((p) => (p.id === listing.id ? { ...p, status: newStatus } : p)));
      toast.success(`Listing ${action}d successfully`);
      setStatusConfirmId(null);
      setStatusConfirmAction(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const deleteListing = async (id: string) => {
    if (!user) return;
    
    setDeleteConfirmId(id);
  };

  const openEditListing = async (p: LocalListing) => {
    setFieldErrors({});
    setEditing(p);
    // For chemical listings, pre-load existing per-size (variant) stock and align QTY to that sum.
    if (activeTab === "chemical" && user && p.variants && p.variants.length > 0) {
      try {
        const stocks = await vendorOnboardingApi.getVariantInventory(user.id, p.id);
        const stockMap: Record<string, number> = {};
        stocks.forEach((s) => { stockMap[s.productVariantId] = s.totalQuantity; });
        // Ensure every catalog variant has a row (default 0) so save always syncs totals.
        p.variants.forEach((v: any) => {
          if (stockMap[v.id] === undefined) stockMap[v.id] = 0;
        });
        const variantTotal = Object.values(stockMap).reduce((sum, n) => sum + (Number(n) || 0), 0);
        setVariantStocks(stockMap);
        setEditing({ ...p, quantity: variantTotal });
      } catch {
        const empty: Record<string, number> = {};
        p.variants.forEach((v: any) => { empty[v.id] = 0; });
        setVariantStocks(empty);
        setEditing({ ...p, quantity: 0 });
      }
    } else {
      setVariantStocks({});
    }
  };

  // Chemicals are priced per packaging size; expose the customer buy-price range + sorted sizes.
  const getChemPricing = (p: LocalListing) => {
    const active = (p.variants || []).filter(
      (v: any) => v?.isActive !== false && typeof v?.buyPrice === "number" && v.buyPrice > 0
    );
    if (active.length === 0) return null;
    const prices = active.map((v: any) => v.buyPrice as number);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const label =
      min === max
        ? `₹${min.toLocaleString("en-IN")}`
        : `₹${min.toLocaleString("en-IN")} – ₹${max.toLocaleString("en-IN")}`;
    const sorted = active.slice().sort((a: any, b: any) => (a.sizeValue ?? 0) - (b.sizeValue ?? 0));
    return { label, sizes: sorted, count: active.length };
  };

  const confirmDeleteListing = async (id: string) => {
    if (!user) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorProductListing(user.id, id);
      setProducts(products.filter((p) => p.id !== id));
      toast.success("Listing deleted successfully");
      setDeleteConfirmId(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const loadCatalogAndListings = async () => {
    if (!user) return { categories: [] as CatalogCategory[], products: [] as CatalogProduct[] };

    const [categoriesRes, productsRes, listingsRes] = await Promise.all([
      vendorOnboardingApi.getProductCategories(),
      vendorOnboardingApi.getProducts(),
      vendorOnboardingApi.getVendorProductListings(user.id),
    ]);

    const inventories = await Promise.all(
      listingsRes.map(async (l) => {
        try {
          return await vendorOnboardingApi.getVendorInventory(user.id, l.id);
        } catch {
          return null;
        }
      })
    );
    const inventoryMap = new Map(inventories.filter(i => i !== null).map(i => [i!.vendorProductListingId, i]));

    const mappedCategories: CatalogCategory[] = categoriesRes.map((c) => ({
      id: c.id,
      name: c.categoryName,
      isChemical: c.isChemical,
    }));
    const mappedProducts: CatalogProduct[] = productsRes.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.productName,
      dailyRent: p.dailyRent,
      monthlyRent: p.monthlyRent,
      securityDeposit: p.securityDeposit,
      buyPrice: p.buyPrice,
      gstPercent: p.gstPercent,
      isRentEnabled: p.isRentEnabled,
      isBuyEnabled: p.isBuyEnabled,
      baseUnit: p.baseUnit,
      casNumber: p.casNumber,
      chemicalFormula: p.chemicalFormula,
      variants: p.variants,
    }));
    const byProductId = new Map(mappedProducts.map((p) => [p.id, p]));
    const byCategoryId = new Map(mappedCategories.map((c) => [c.id, c]));

    // For chemicals, QTY must come from per-size (variant) stock — not the flat listing inventory.
    const chemicalListingIds = listingsRes
      .filter((l) => {
        const product = byProductId.get(l.productId);
        const category = product ? byCategoryId.get(product.categoryId) : undefined;
        return !!(category?.isChemical || product?.baseUnit || product?.casNumber || product?.chemicalFormula || l.isChemical);
      })
      .map((l) => l.id);

    const variantInventoryByListing = new Map<string, number>();
    await Promise.all(
      chemicalListingIds.map(async (listingId) => {
        try {
          const rows = await vendorOnboardingApi.getVariantInventory(user.id, listingId);
          const total = rows.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
          variantInventoryByListing.set(listingId, total);
        } catch {
          // Keep listing-level qty as fallback when variant inventory is unavailable.
        }
      })
    );

    setCategories(mappedCategories);
    setCatalogProducts(mappedProducts);
    setProducts(
      listingsRes.map((l) => {
        const product = byProductId.get(l.productId);
        const category = product ? byCategoryId.get(product.categoryId) : undefined;
        const isChemical = !!(category?.isChemical || product?.baseUnit || product?.casNumber || product?.chemicalFormula || l.isChemical);
        const listingQty = inventoryMap.get(l.id)?.totalQuantity ?? l.availableQuantity;
        const quantity = isChemical && variantInventoryByListing.has(l.id)
          ? (variantInventoryByListing.get(l.id) ?? 0)
          : listingQty;
        return {
          id: l.id,
          productId: l.productId,
          categoryId: product?.categoryId ?? "",
          category: category?.name ?? "Unknown",
          productName: product?.name ?? "Unknown",
          title: l.listingTitle,
          dailyRent: product?.dailyRent ?? l.dailyRent,
          monthlyRent: product?.monthlyRent ?? l.monthlyRent,
          securityDeposit: product?.securityDeposit ?? l.securityDeposit,
          buyPrice: product?.buyPrice,
          gstPercent: product?.gstPercent ?? 18,
          isRentEnabled: product?.isRentEnabled ?? true,
          isBuyEnabled: product?.isBuyEnabled ?? true,
          quantity,
          status: normalizeListingStatus(l.listingStatus),
          images: [],
          favoriteCount: l.favoriteCount ?? 0,
          createdAt: new Date().toISOString(),
          baseUnit: product?.baseUnit,
          casNumber: product?.casNumber,
          chemicalFormula: product?.chemicalFormula,
          variants: product?.variants || [],
          isChemical,
        };
      })
    );

    return { categories: mappedCategories, products: mappedProducts };
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        await loadCatalogAndListings();
      } catch (error) {
        const message = getUserFriendlyMessage(error);
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void load();
  }, [user]);

  const openNew = async () => {
    setFieldErrors({});
    // Refresh catalog data to get latest products and categories
    const loaded = await loadCatalogAndListings();
    const freshCategories = loaded?.categories ?? categories;
    const freshProducts = loaded?.products ?? catalogProducts;
    
    const availableCategories = freshCategories.filter(c => freshProducts.some(p => p.categoryId === c.id && (activeTab === "chemical" ? isChemicalCatalogProduct(p, freshCategories) : !isChemicalCatalogProduct(p, freshCategories))));
    const firstCategory = availableCategories[0] || freshCategories[0];
    const firstProduct = firstCategory ? freshProducts.find((p) => p.categoryId === firstCategory.id && (activeTab === "chemical" ? isChemicalCatalogProduct(p, freshCategories) : !isChemicalCatalogProduct(p, freshCategories))) : undefined;
    setVariantStocks({});
    setEditing(blankListing(firstCategory, firstProduct));
  };

  const onCategoryChange = (categoryId: string) => {
    if (!editing) return;
    const category = categories.find((c) => c.id === categoryId);
    const firstProduct = catalogProducts.find((p) => p.categoryId === categoryId && (activeTab === "chemical" ? isChemicalCatalogProduct(p) : !isChemicalCatalogProduct(p)));
    setEditing({
      ...editing,
      categoryId,
      category: category?.name ?? "",
      productId: firstProduct?.id ?? "",
      productName: firstProduct?.name ?? "",
    });
  };

  const save = async () => {
    if (!editing || !user) return;

    const errors: Record<string, string> = {};
    if (!editing.categoryId?.trim()) {
      errors.categoryId = "Please select a category.";
    }
    if (!editing.productId?.trim()) {
      errors.productId = "Please select a product.";
    }
    if (!editing.title?.trim()) {
      errors.title = "Please enter a listing title.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    try {
      setBusy(true);
      setFieldErrors({});
      let savedListingId = editing.id;

      const isChemical = activeTab === "chemical" || !!editing.isChemical;
      const hasVariants = !!(editing.variants && editing.variants.length > 0);
      const isNewListing = !editing.id;

      // Chemicals: initial stock is set only when creating the listing (same rule as equipment Quantity).
      const chemicalQty = hasVariants
        ? editing.variants!.reduce((sum: number, v: any) => sum + (Number(variantStocks[v.id]) || 0), 0)
        : editing.quantity;
      const quantityToSave = isChemical
        ? (isNewListing ? chemicalQty : editing.quantity)
        : editing.quantity;

      if (editing.id) {
        await vendorOnboardingApi.updateVendorProductListing(user.id, editing.id, {
          vendorId: user.id,
          listingId: editing.id,
          productId: editing.productId,
          listingTitle: editing.title,
          availableQuantity: quantityToSave,
          listingStatus: editing.status,
        });
      } else {
        const created = await vendorOnboardingApi.createVendorProductListing(user.id, {
          vendorId: user.id,
          productId: editing.productId,
          listingTitle: editing.title,
          availableQuantity: quantityToSave,
          listingStatus: editing.status,
        });
        savedListingId = created.id;
      }

      // Seed per-SKU stock only on first create — later changes go through Inventory.
      if (isChemical && hasVariants && savedListingId && isNewListing) {
        const items = editing.variants!.map((v: any) => ({
          productVariantId: v.id as string,
          totalQuantity: Number(variantStocks[v.id]) || 0,
        }));
        await vendorOnboardingApi.upsertVariantInventory(user.id, savedListingId, items);
      }

      await loadCatalogAndListings();
      setEditing(null);
      setVariantStocks({});
      toast.success("Listing saved");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openCreateCategory = () => {
    setNewCategoryName("");
    setCategoryDialogOpen(true);
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setBusy(true);
      await vendorOnboardingApi.createProductCategory({
        categoryName: newCategoryName.trim(),
        prescriptionRequired: false,
        depositRequired: false,
        installationRequired: false,
        isActive: true,
      });
      await loadCatalogAndListings();
      setCategoryDialogOpen(false);
      toast.success("Category created");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openCreateProduct = () => {
    if (!editing?.categoryId) {
      toast.error("Select a category first.");
      return;
    }

    setNewProductName("");
    setNewProductBrand("");
    setNewProductModel("");
    setProductDialogOpen(true);
  };

  const createProduct = async () => {
    if (!editing?.categoryId) {
      toast.error("Select a category first.");
      return;
    }
    if (!newProductName.trim()) {
      toast.error("Product name is required.");
      return;
    }

    try {
      setBusy(true);
      const created = await vendorOnboardingApi.createProduct({
        categoryId: editing.categoryId,
        productName: newProductName.trim(),
        brandName: newProductBrand.trim() || undefined,
        modelName: newProductModel.trim() || undefined,
        isActive: true,
      });
      await loadCatalogAndListings();
      setEditing({
        ...editing,
        productId: created.id,
        productName: created.productName,
      });
      setProductDialogOpen(false);
      toast.success("Product created");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openMedia = async (p: LocalListing) => {
    if (!user) return;
    // Open dialog immediately so listing doesn't go blank
    setMediaFor(p);
    setTempImages([]);
    setListingDocuments([]);
    try {
      const [imagesRes, docsRes] = await Promise.all([
        vendorOnboardingApi.getVendorProductImages(user.id, p.id),
        vendorOnboardingApi.getVendorProductDocuments(user.id, p.id),
      ]);

      setTempImages(imagesRes
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((img) => ({
          id: img.id,
          primary: img.isPrimary,
          url: normalizeHostedFileUrl(img.imageUrl),
          persisted: true,
        })));
      setListingDocuments(docsRes);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    }
  };

  const setPrimary = (id: string) => setTempImages((imgs) => imgs.map((i) => ({ ...i, primary: i.id === id })));
  const removeImg = (id: string) => {
    const img = tempImages.find((i) => i.id === id);
    if (!img) return;

    if (!img.persisted) {
      setTempImages((imgs) => imgs.filter((i) => i.id !== id));
      return;
    }

    setDeleteImageConfirmId(id);
  };

  const confirmRemoveImg = async (id: string) => {
    if (!user || !mediaFor) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorProductImage(user.id, mediaFor.id, id);
      const imagesRes = await vendorOnboardingApi.getVendorProductImages(user.id, mediaFor.id);
      setTempImages(imagesRes
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((serverImg) => ({
          id: serverImg.id,
          primary: serverImg.isPrimary,
          url: normalizeHostedFileUrl(serverImg.imageUrl),
          persisted: true,
        })));
      toast.success("Image deleted");
      setDeleteImageConfirmId(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const addImg = async (files: FileList | null) => {
    if (!user || !mediaFor) return;
    if (!files || files.length === 0) return;
    try {
      setBusy(true);
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const fileResult = await vendorOnboardingApi.uploadVendorFile(user.id, file, VendorFileFolderType.ProductImages);
          return {
            id: `temp-${Date.now()}-${file.name}`,
            primary: false,
            url: normalizeHostedFileUrl(fileResult.fileUrl),
            storageKey: fileResult.storageKey ?? undefined,
            persisted: false,
          } satisfies MediaImage;
        })
      );
      setTempImages((imgs) => {
        const merged = [...imgs, ...uploaded];
        if (merged.length > 0 && !merged.some((img) => img.primary)) {
          merged[0] = { ...merged[0], primary: true };
        }
        return merged;
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const reorder = (from: number, to: number) => setTempImages((imgs) => { const c = [...imgs]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  const previewImage = (url: string) => setPreviewUrl(normalizeHostedFileUrl(url));

  const saveMedia = async () => {
    if (!mediaFor || !user) return;

    try {
      setBusy(true);
      const unsaved = tempImages.filter((i) => !i.persisted);
      if (unsaved.length > 0) {
        await Promise.all(
          unsaved.map((img, idx) =>
            vendorOnboardingApi.addVendorProductImage(user.id, mediaFor.id, {
              vendorId: user.id,
              listingId: mediaFor.id,
              imageUrl: img.storageKey ?? img.url,
              displayOrder: tempImages.length + idx + 1,
              isPrimary: img.primary,
            })
          )
        );
      }
      setMediaFor(null);
      toast.success("Media updated");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const uploadListingDoc = async () => {
    if (!mediaFor || !user || !docFile) return;
    try {
      setBusy(true);
      const fileResult = await vendorOnboardingApi.uploadVendorFile(user.id, docFile, VendorFileFolderType.ProductDocuments);
      await vendorOnboardingApi.addVendorProductDocument(user.id, mediaFor.id, {
        vendorId: user.id,
        listingId: mediaFor.id,
        documentType: docType,
        fileUrl: fileResult.storageKey ?? fileResult.fileUrl,
      });
      const docs = await vendorOnboardingApi.getVendorProductDocuments(user.id, mediaFor.id);
      setListingDocuments(docs);
      setDocFile(null);
      if (docFileInputRef.current) {
        docFileInputRef.current.value = "";
      }
      toast.success("Listing document uploaded");
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const viewListingDoc = (doc: { id: string; documentType: string; fileUrl: string }) => {
    setPreviewDocument({ id: doc.id, type: doc.documentType, url: normalizeHostedFileUrl(doc.fileUrl) });
  };

  const deleteListingDoc = (documentId: string) => {
    setDeleteDocConfirmId(documentId);
  };

  const confirmDeleteListingDoc = async (documentId: string) => {
    if (!user || !mediaFor) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorProductDocument(user.id, mediaFor.id, documentId);
      const docs = await vendorOnboardingApi.getVendorProductDocuments(user.id, mediaFor.id);
      setListingDocuments(docs);
      toast.success("Document deleted");
      setDeleteDocConfirmId(null);
    } catch (error) {
      const message = getUserFriendlyMessage(error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your rental catalog. Add new listings and control availability. Pricing is admin-managed."
        actions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button onClick={openNew} className="bg-gradient-primary shadow-glow" disabled={busy || isPending}>
                    <Plus className="mr-2 h-4 w-4" /> New listing
                  </Button>
                </span>
              </TooltipTrigger>
              {isPending && (
                <TooltipContent side="bottom">
                  <p>Available once your account is approved</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        }
      />

      {!hasLoaded && busy && (
        <div className="space-y-4 animate-pulse">
          {/* Search and Filter Skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Skeleton className="h-10 w-full pl-9" />
              <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          
          {/* Product Grid Skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-video bg-muted">
                  <Skeleton className="h-full w-full" />
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {hasLoaded && (
      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loadError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "equipment" | "chemical")}>
          <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="equipment" className="text-xs sm:text-sm">
              <Package className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Equipment</span>
              <span className="hidden sm:inline ml-1">({products.filter(p => !isChemicalListing(p)).length})</span>
            </TabsTrigger>
            <TabsTrigger value="chemical" className="text-xs sm:text-sm">
              <FlaskConical className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Chemicals</span>
              <span className="hidden sm:inline ml-1">({products.filter(p => isChemicalListing(p)).length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings…" className="w-full pl-9" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch id="vendor-favorites-only" checked={showFavoritesOnly} onCheckedChange={setShowFavoritesOnly} />
              <Label htmlFor="vendor-favorites-only" className="text-sm cursor-pointer whitespace-nowrap">Favorites Only</Label>
            </div>
            <Tabs value={filter} onValueChange={handleFilterChange}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="all" className="flex-1 sm:flex-none">All <span className="ml-1.5 text-xs text-muted-foreground">({products.length})</span></TabsTrigger>
                <TabsTrigger value="active" className="flex-1 sm:flex-none">Active</TabsTrigger>
                <TabsTrigger value="inactive" className="flex-1 sm:flex-none">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold sm:px-4">Listing</th>
                <th className="px-3 py-3 font-semibold sm:px-4">Category</th>
                {activeTab === "equipment" && <th className="px-3 py-3 font-semibold text-right sm:px-4">Rent (Admin)</th>}
                {activeTab === "chemical" && <th className="px-3 py-3 font-semibold text-right sm:px-4">Buy Price (Admin)</th>}
                {activeTab === "equipment" && <th className="px-3 py-3 font-semibold text-right sm:px-4">Deposit</th>}
                <th className="px-3 py-3 font-semibold text-right sm:px-4">Qty</th>
                <th className="px-3 py-3 font-semibold sm:px-4">Status</th>
                <th className="px-3 py-3 sm:px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProducts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 align-middle">
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-soft">
                        <ImageIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium truncate">{p.title}</p>
                          {(p.favoriteCount ?? 0) > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center shrink-0 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full font-medium cursor-default">
                                    ❤️ {p.favoriteCount}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Favorited by {p.favoriteCount} {p.favoriteCount === 1 ? 'customer' : 'customers'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.productName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground sm:px-4">{p.category}</td>
                  {activeTab === "equipment" && (
                    <td className="px-3 py-3 text-right font-mono sm:px-4">
                      ₹{p.dailyRent}/d
                    </td>
                  )}
                  {activeTab === "chemical" && (
                    <td className="px-3 py-3 text-right font-mono sm:px-4">
                      {(() => {
                        const pricing = getChemPricing(p);
                        if (!pricing) {
                          return <span className="text-muted-foreground">—</span>;
                        }
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex cursor-default flex-col items-end">
                                  <span className="whitespace-nowrap tabular-nums">{pricing.label}</span>
                                  <span className="font-sans text-[10px] font-normal text-muted-foreground">
                                    {pricing.count} {pricing.count === 1 ? "size" : "sizes"}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" align="center" className="min-w-[10rem] p-0">
                                <div className="border-b border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Price by size
                                </div>
                                <div className="max-h-64 divide-y divide-border/40 overflow-auto px-3 py-1.5 font-sans text-xs">
                                  {pricing.sizes.map((v: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between gap-6 py-1">
                                      <span className="text-muted-foreground">
                                        {v.sizeValue} {v.sizeUnit}
                                      </span>
                                      <span className="font-semibold tabular-nums">
                                        ₹{(v.buyPrice as number).toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </td>
                  )}
                  {activeTab === "equipment" && (
                    <td className="px-3 py-3 text-right font-mono sm:px-4">
                      ₹{p.securityDeposit}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right sm:px-4">{p.quantity}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <Switch
                      checked={p.status === "active"}
                      onCheckedChange={() => toggleListingStatus(p)}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-3 py-3 text-right sm:px-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => void openMedia(p)} aria-label="Media" disabled={busy}>
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void openEditListing(p)} aria-label="Edit" disabled={busy}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteListing(p.id)} aria-label="Delete" disabled={busy}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {hasLoaded && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground sm:px-4">
                    {products.length === 0
                      ? "No listings created yet."
                      : "No listings match your current search/filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: card layout (table becomes unreadable on narrow screens) */}
        <div className="space-y-3 md:hidden">
          {paginatedProducts.map((p) => {
            const pricing = activeTab === "chemical" ? getChemPricing(p) : null;
            return (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-soft">
                      <ImageIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium">{p.title}</p>
                        {(p.favoriteCount ?? 0) > 0 && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            ❤️ {p.favoriteCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{p.productName}</p>
                    </div>
                  </div>
                  <Switch
                    checked={p.status === "active"}
                    onCheckedChange={() => toggleListingStatus(p)}
                    disabled={busy}
                  />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Category</dt>
                    <dd className="truncate">{p.category}</dd>
                  </div>
                  <div className="min-w-0 text-right">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Qty</dt>
                    <dd className="font-mono tabular-nums">{p.quantity}</dd>
                  </div>
                  {activeTab === "equipment" ? (
                    <>
                      <div className="min-w-0">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Rent (Admin)</dt>
                        <dd className="font-mono tabular-nums">₹{p.dailyRent}/d</dd>
                      </div>
                      <div className="min-w-0 text-right">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Deposit</dt>
                        <dd className="font-mono tabular-nums">₹{p.securityDeposit}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Buy Price (Admin)</dt>
                      {pricing ? (
                        <dd className="mt-1">
                          <span className="font-mono font-semibold tabular-nums">{pricing.label}</span>
                          <ChemSizeBreakdown sizes={pricing.sizes} />
                        </dd>
                      ) : (
                        <dd className="text-muted-foreground">—</dd>
                      )}
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2">
                  <Button variant="ghost" size="icon" onClick={() => void openMedia(p)} aria-label="Media" disabled={busy}>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void openEditListing(p)} aria-label="Edit" disabled={busy}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteListing(p.id)} aria-label="Delete" disabled={busy}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          {hasLoaded && filtered.length === 0 && (
            <div className="rounded-lg border border-border px-3 py-8 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "No listings created yet."
                : "No listings match your current search/filter."}
            </div>
          )}
        </div>

        {true && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-4">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} products
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent className="flex-wrap justify-center">
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page} className="hidden sm:block">
                    <PaginationLink 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
      )}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{products.some((p) => p.id === editing?.id) ? "Edit listing" : "New listing"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          {editing && (
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
              <FormGrid cols={2}>
              <div className="space-y-1.5">
                <Label required>Category {editing.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(Cannot be changed)</span>}</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={editing.categoryId}
                    onValueChange={(v) => {
                      onCategoryChange(v);
                      clearFieldError("categoryId");
                    }}
                    disabled={!!editing.id}
                  >
                    <SelectTrigger className={`pl-1 ${fieldErrors.categoryId ? "border-destructive" : ""}`}><SelectValue className="text-left min-w-0" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter(c => catalogProducts.some(p => p.categoryId === c.id && (activeTab === "chemical" ? isChemicalCatalogProduct(p) : !isChemicalCatalogProduct(p)))).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Vendor catalog creation disabled - managed by admin */}
                  {/* <Button variant="outline" onClick={openCreateCategory} type="button" disabled={busy}>New</Button> */}
                </div>
                <FieldError message={fieldErrors.categoryId} />
              </div>
              <div className="space-y-1.5">
                <Label required>Product (from catalog) {editing.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(Cannot be changed)</span>}</Label>
                <div className="flex items-center gap-2">
                  <Select value={editing.productId} disabled={!!editing.id} onValueChange={(v) => {
                    const selected = catalogProducts.find((p) => p.id === v);
                    setEditing({
                      ...editing,
                      productId: v,
                      productName: selected?.name ?? "",
                      dailyRent: selected?.dailyRent ?? 0,
                      monthlyRent: selected?.monthlyRent ?? 0,
                      securityDeposit: selected?.securityDeposit ?? 0,
                      buyPrice: selected?.buyPrice,
                      gstPercent: selected?.gstPercent ?? 18,
                      isRentEnabled: selected?.isRentEnabled ?? true,
                      isBuyEnabled: selected?.isBuyEnabled ?? true,
                    });
                    clearFieldError("productId");
                  }}>
                    <SelectTrigger className={`pl-1 ${fieldErrors.productId ? "border-destructive" : ""}`}><SelectValue placeholder="Choose product" className="text-left min-w-0" /></SelectTrigger>
                    <SelectContent>
                      {catalogProducts.filter((p) => p.categoryId === editing.categoryId && (activeTab === "chemical" ? isChemicalCatalogProduct(p) : !isChemicalCatalogProduct(p))).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Vendor catalog creation disabled - managed by admin */}
                  {/* <Button variant="outline" onClick={openCreateProduct} type="button" disabled={busy}>New</Button> */}
                </div>
                <FieldError message={fieldErrors.productId} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label required>Listing title</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => {
                    setEditing({ ...editing, title: e.target.value });
                    clearFieldError("title");
                  }}
                  placeholder="E.g. Sony A7 III — Daily Rental"
                  className={fieldErrors.title ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.title} />
              </div>
              {activeTab === "equipment" && (
                <div className="space-y-1.5">
                  <Label>Daily rent (Admin-set)</Label>
                  <Input value={`₹${editing.dailyRent}`} readOnly />
                </div>
              )}
              {activeTab === "equipment" && (
                <div className="space-y-1.5">
                  <Label>Monthly rent (Admin-set)</Label>
                  <Input value={`₹${editing.monthlyRent}`} readOnly />
                </div>
              )}
              {activeTab === "chemical" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-semibold text-xs text-muted-foreground">Chemical Sizing & Pricing Chart (Admin-set)</Label>
                  {(!editing.variants || editing.variants.length === 0) ? (
                    <Input value={editing.buyPrice ? `₹${editing.buyPrice}` : "Not enabled"} readOnly className="bg-muted/50" />
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border mt-1">
                      <table className="w-full text-xs text-left border-collapse bg-muted/20">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                            <th className="p-2 font-semibold">SKU</th>
                            <th className="p-2 font-semibold text-right">Size Value</th>
                            <th className="p-2 font-semibold">Size Unit</th>
                            <th className="p-2 font-semibold text-right">Vendor Payout Price</th>
                            <th className="p-2 font-semibold text-right">Customer Buy Price</th>
                            <th className="p-2 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editing.variants.map((v: any, idx: number) => (
                            <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/10">
                              <td className="p-2 font-mono text-[11px]">{v.sku}</td>
                              <td className="p-2 text-right font-medium">{v.sizeValue}</td>
                              <td className="p-2">{v.sizeUnit}</td>
                              <td className="p-2 text-right font-medium text-emerald-600 dark:text-emerald-400">₹{v.vendorPrice}</td>
                              <td className="p-2 text-right font-medium text-indigo-600 dark:text-indigo-400">₹{v.buyPrice}</td>
                              <td className="p-2 text-center">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${v.isActive ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`}>
                                  {v.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {activeTab === "equipment" && (
                <div className="space-y-1.5">
                  <Label>Security deposit (Admin-set)</Label>
                  <Input value={`₹${editing.securityDeposit}`} readOnly />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>GST % (Admin-set)</Label>
                <Input value={`${editing.gstPercent ?? 18}%`} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Modes (Admin-set)</Label>
                <Input value={`${editing.isRentEnabled ? "Rent" : ""}${editing.isRentEnabled && editing.isBuyEnabled ? " + " : ""}${editing.isBuyEnabled ? "Buy" : ""}${!editing.isRentEnabled && !editing.isBuyEnabled ? "Unavailable" : ""}`} readOnly />
              </div>
              {/* Quantity field: for equipment show single number, for chemicals show per-variant stock table */}
              {activeTab === "equipment" && (
                <div className="space-y-1.5">
                  <Label>
                    Quantity
                    {editing.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(Manage via Inventory)</span>}
                  </Label>
                  <Input 
                    type="number" 
                    value={editing.quantity} 
                    readOnly={!!editing.id} 
                    className={editing.id ? "bg-muted/50" : ""}
                    onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} 
                  />
                </div>
              )}
              {activeTab === "chemical" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="font-semibold text-xs">
                    Stock per Packaging Size
                    {editing.id && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (Manage via Inventory after first save)
                      </span>
                    )}
                  </Label>
                  {(!editing.variants || editing.variants.length === 0) ? (
                    <p className="text-xs text-muted-foreground border border-border rounded-md p-3 bg-muted/20">
                      No packaging sizes defined for this chemical yet. Ask Admin to add variants (e.g. 1L, 5L) first.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border mt-1">
                      <table className="w-full text-xs text-left border-collapse bg-muted/20">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                            <th className="p-2 font-semibold">SKU</th>
                            <th className="p-2 font-semibold text-right">Size</th>
                            <th className="p-2 font-semibold text-right text-indigo-600 dark:text-indigo-400">Stock (Units)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editing.variants.map((v: any, idx: number) => (
                            <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/10">
                              <td className="p-2 font-mono text-[11px]">{v.sku}</td>
                              <td className="p-2 text-right font-medium">{v.sizeValue} {v.sizeUnit}</td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  readOnly={!!editing.id}
                                  className={`h-7 w-20 text-right ml-auto text-xs ${editing.id ? "bg-muted/50" : ""}`}
                                  value={variantStocks[v.id] ?? 0}
                                  onChange={(e) => {
                                    if (editing.id) return;
                                    const next = Math.max(0, Number(e.target.value) || 0);
                                    setVariantStocks((prev) => {
                                      const updated = { ...prev, [v.id]: next };
                                      const total = (editing.variants || []).reduce(
                                        (sum: number, row: any) => sum + (Number(updated[row.id]) || 0),
                                        0
                                      );
                                      setEditing((curr) => (curr ? { ...curr, quantity: total } : curr));
                                      return updated;
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/30">
                            <td className="p-2 font-semibold" colSpan={2}>Total QTY</td>
                            <td className="p-2 text-right font-semibold tabular-nums">
                              {(editing.variants || []).reduce(
                                (sum: number, row: any) => sum + (Number(variantStocks[row.id]) || 0),
                                0
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {editing.id && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground border-t border-border">
                          After the listing is created, change packaging stock only from{" "}
                          <span className="font-medium text-foreground">Inventory → Chemicals</span>.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v as ProductListing["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
            <div className="h-5" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                "Save listing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category creation dialog - Disabled, managed by admin */}
      {/* <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <p className="text-xs text-muted-foreground">
              Create a reusable catalog category for future products and listings.
            </p>
            <div className="space-y-1.5">
            <Label>Category name</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="E.g. Home Appliance Rentals"
            />
            <div className="h-5" />
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void createCategory()} disabled={busy}>Create category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {/* Product creation dialog - Disabled, managed by admin */}
      {/* <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <p className="text-xs text-muted-foreground">
              Product will be created under the selected category in the listing form.
            </p>
            <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product name</Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="E.g. Washing Machine"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Brand (optional)</Label>
              <Input
                value={newProductBrand}
                onChange={(e) => setNewProductBrand(e.target.value)}
                placeholder="E.g. IFB"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Model (optional)</Label>
              <Input
                value={newProductModel}
                onChange={(e) => setNewProductModel(e.target.value)}
                placeholder="E.g. Senator Plus SX"
              />
            </div>
            <div className="h-5" />
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void createProduct()} disabled={busy}>Create product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
      <Dialog open={!!mediaFor} onOpenChange={(v) => !v && setMediaFor(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
            <DialogTitle>Manage images</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
            <Tabs defaultValue="images" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="images" className="space-y-4">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy} className="w-full sm:w-auto">
                  <Upload className="mr-2 h-4 w-4" /> Upload images
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void addImg(e.target.files);
                  }}
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {tempImages.map((img, idx) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const from = +e.dataTransfer.getData("text/plain"); reorder(from, idx); }}
                      className={`group relative aspect-square cursor-move overflow-hidden rounded-lg border-2 ${img.primary ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                    >
                      <img src={img.url} alt={`Product image ${idx + 1}`} className="h-full w-full object-cover" />
                      {img.primary && (
                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          <Star className="h-3 w-3" fill="currentColor" /> Primary
                        </div>
                      )}
                      <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button onClick={() => previewImage(img.url)} className="rounded-md bg-background/90 p-1 text-foreground hover:bg-background" aria-label="Preview">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {!img.primary && (
                          <button onClick={() => setPrimary(img.id)} className="rounded-md bg-background/90 p-1 text-foreground hover:bg-background" aria-label="Set primary">
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => void removeImg(img.id)} className="rounded-md bg-background/90 p-1 text-destructive hover:bg-background" aria-label="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tempImages.length === 0 && (
                    <div className="col-span-2 rounded-lg border border-dashed border-border p-4 sm:p-6 text-center text-sm text-muted-foreground sm:col-span-4">
                      No images uploaded yet.
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Drag to reorder on desktop. The primary image appears first in your listing.</p>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-4 font-medium">Listing documents</h3>
                  
                  {/* Upload Section */}
                  <div className="space-y-4">
                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-12 gap-4 items-end">
                        {/* Document Type */}
                        <div className="col-span-3">
                          <label className="text-sm font-medium text-foreground mb-2 block">Document Type</label>
                          <Select value={docType} onValueChange={setDocType}>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spec_sheet">Spec Sheet</SelectItem>
                              <SelectItem value="warranty">Warranty</SelectItem>
                              <SelectItem value="compliance">Compliance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* File Upload */}
                        <div className="col-span-6">
                          <label className="text-sm font-medium text-foreground mb-2 block">Choose File</label>
                          <div className="relative">
                            <Input
                              ref={docFileInputRef}
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.webp"
                              onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex items-center h-10 px-3 py-2 border border-border rounded-md bg-background text-sm shadow-sm">
                              <Upload className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground flex-1 truncate">
                                {docFile ? docFile.name : "Choose file"}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Upload Button */}
                        <div className="col-span-3">
                          <Button 
                            onClick={() => void uploadListingDoc()} 
                            disabled={busy || !docFile} 
                            className="w-full h-10"
                          >
                            <Upload className="h-4 w-4" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="sm:hidden space-y-4">
                      {/* Document Type */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Document Type</label>
                        <Select value={docType} onValueChange={setDocType}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spec_sheet">Spec Sheet</SelectItem>
                            <SelectItem value="warranty">Warranty</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* File Upload */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Choose File</label>
                        <div className="relative">
                          <Input
                            ref={docFileInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex items-center h-10 px-3 py-2 border border-border rounded-md bg-background text-sm shadow-sm">
                            <Upload className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground flex-1 truncate">
                              {docFile ? docFile.name : "Choose file"}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Upload Button */}
                      <Button 
                        onClick={() => void uploadListingDoc()} 
                        disabled={busy || !docFile} 
                        className="w-full h-10"
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                    </div>
                    
                    {/* File Info Display */}
                    {docFile && (
                      <div className="rounded-md bg-muted/30 p-3 border border-border/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{docFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Size: {(docFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setDocFile(null)}
                            className="text-muted-foreground hover:text-foreground ml-2"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Documents List */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-foreground mb-3">Uploaded Documents</h4>
                    <div className="space-y-2">
                      {listingDocuments.map((doc) => (
                        <div key={doc.id} className="rounded-md border border-border p-3">
                          {/* Desktop: horizontal layout */}
                          <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{doc.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                <p className="text-xs text-muted-foreground truncate">{getFileNameFromUrl(doc.fileUrl)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewListingDoc(doc)}
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="h-4 w-4 mr-1" /> Preview
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteListingDoc(doc.id)}
                                className="h-8 px-2 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                          {/* Mobile: vertical layout with buttons below */}
                          <div className="sm:hidden">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium leading-tight">{doc.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">{getFileNameFromUrl(doc.fileUrl)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewListingDoc(doc)}
                                className="h-8 text-xs flex-1"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteListingDoc(doc.id)}
                                className="h-8 text-xs flex-1 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {listingDocuments.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No documents uploaded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="border-t px-4 py-3 sm:px-6">
            <Button variant="outline" onClick={() => setMediaFor(null)} disabled={busy}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <Button onClick={() => void saveMedia()} disabled={busy}>
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img src={previewUrl} alt="Preview" className="max-h-[60vh] w-full object-contain bg-muted/20" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewUrl(null)} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Card */}
      {deleteConfirmId && (() => {
        const listing = products.find(p => p.id === deleteConfirmId);
        if (!listing) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Delete Listing</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">Are you sure you want to delete this listing?</p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">{listing.productName}</p>
                  <p className="text-xs text-muted-foreground">{listing.category}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => confirmDeleteListing(deleteConfirmId)}
                  className="flex-1"
                  disabled={busy}
                >
                  {busy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="mr-2 h-4 w-4" /> Delete Listing</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {/* Status Confirmation Card */}
      {statusConfirmId && statusConfirmAction && (() => {
        const listing = products.find(p => p.id === statusConfirmId);
        if (!listing) return null;
        const isActivating = statusConfirmAction === 'activate';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActivating ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {isActivating ? (
                    <ImageIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {isActivating ? 'Activate Listing' : 'Deactivate Listing'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isActivating ? 'This will make the listing visible to customers' : 'This will hide the listing from customers'}
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to {isActivating ? 'activate' : 'deactivate'} this listing?
                </p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">{listing.productName}</p>
                  <p className="text-xs text-muted-foreground">{listing.category}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${listing.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs text-muted-foreground">
                      Currently: {listing.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatusConfirmId(null);
                    setStatusConfirmAction(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant={isActivating ? 'default' : 'secondary'}
                  onClick={() => confirmStatusChange(statusConfirmId, statusConfirmAction)}
                  className="flex-1"
                  disabled={busy}
                >
                  {busy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isActivating ? 'Activating...' : 'Deactivating...'}</>
                  ) : (
                    <><ImageIcon className="mr-2 h-4 w-4" /> {isActivating ? 'Activate Listing' : 'Deactivate Listing'}</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Document Preview Dialog */}
      <Dialog open={previewDocument !== null} onOpenChange={(open) => { if (!open) setPreviewDocument(null); }}>
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
                />
                  );
                }

                if (isPdf) {
                  return (
                <iframe
                  src={previewDocument.url}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
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
              onClick={() => setPreviewDocument(null)}
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

      {/* Document Delete Confirmation Dialog */}
      <Dialog open={!!deleteDocConfirmId} onOpenChange={(open) => !open && setDeleteDocConfirmId(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this document?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDocConfirmId(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDocConfirmId && confirmDeleteListingDoc(deleteDocConfirmId)}
              className="w-full sm:w-auto"
              disabled={busy}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Delete Confirmation Dialog */}
      <Dialog open={!!deleteImageConfirmId} onOpenChange={(open) => !open && setDeleteImageConfirmId(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this image?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteImageConfirmId(null)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteImageConfirmId && confirmRemoveImg(deleteImageConfirmId)}
              className="w-full sm:w-auto"
              disabled={busy}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;

interface MediaImage {
  id: string;
  primary: boolean;
  url: string;
  /** DB persistence path when using object storage */
  storageKey?: string;
  persisted: boolean;
}

interface ListingDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  verificationStatus: string;
}
