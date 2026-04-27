import { useEffect, useMemo, useState, useRef } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { ProductListing } from "@/app/models";
import { Plus, Search, Pencil, Image as ImageIcon, Star, Upload, Trash2, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

type LocalListing = ProductListing & {
  productId: string;
  categoryId: string;
};

type CatalogCategory = {
  id: string;
  name: string;
};

type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
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
  quantity: 1,
  status: "draft",
  images: [],
  createdAt: new Date().toISOString(),
});

const Products = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<LocalListing[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = products.filter((p) => {
    const m = (filter === "all" || p.status === filter);
    const s = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    return m && s;
  });

  const toggleListingStatus = async (listing: LocalListing) => {
    try {
      setBusy(true);
      const newStatus = listing.status === "active" ? "inactive" : "active";
      const updated = await vendorOnboardingApi.updateVendorProductListing(user.id, listing.id, {
        vendorId: user.id,
        listingId: listing.id,
        productId: listing.productId,
        listingTitle: listing.title,
        dailyRent: listing.dailyRent,
        monthlyRent: listing.monthlyRent,
        securityDeposit: listing.securityDeposit,
        availableQuantity: listing.quantity,
        listingStatus: newStatus,
      });
      setProducts(products.map((p) => (p.id === listing.id ? { ...p, status: newStatus } : p)));
      toast.success("Listing status updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update listing status.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const loadCatalogAndListings = async () => {
    if (!user) return;

    const [categoriesRes, productsRes, listingsRes] = await Promise.all([
      vendorOnboardingApi.getProductCategories(),
      vendorOnboardingApi.getProducts(),
      vendorOnboardingApi.getVendorProductListings(user.id),
    ]);

    const mappedCategories: CatalogCategory[] = categoriesRes.map((c) => ({ id: c.id, name: c.categoryName }));
    const mappedProducts: CatalogProduct[] = productsRes.map((p) => ({ id: p.id, categoryId: p.categoryId, name: p.productName }));
    const byProductId = new Map(mappedProducts.map((p) => [p.id, p]));
    const byCategoryId = new Map(mappedCategories.map((c) => [c.id, c]));

    setCategories(mappedCategories);
    setCatalogProducts(mappedProducts);
    setProducts(
      listingsRes.map((l) => {
        const product = byProductId.get(l.productId);
        const category = product ? byCategoryId.get(product.categoryId) : undefined;
        return {
          id: l.id,
          productId: l.productId,
          categoryId: product?.categoryId ?? "",
          category: category?.name ?? "Unknown",
          productName: product?.name ?? "Unknown",
          title: l.listingTitle,
          dailyRent: l.dailyRent,
          monthlyRent: l.monthlyRent,
          securityDeposit: l.securityDeposit,
          quantity: l.availableQuantity,
          status: normalizeListingStatus(l.listingStatus),
          images: [],
          createdAt: new Date().toISOString(),
        };
      })
    );
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        await loadCatalogAndListings();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load product listings.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void load();
  }, [user]);

  const openNew = () => {
    const firstCategory = categories[0];
    const firstProduct = firstCategory ? catalogProducts.find((p) => p.categoryId === firstCategory.id) : undefined;
    setEditing(blankListing(firstCategory, firstProduct));
  };

  const onCategoryChange = (categoryId: string) => {
    if (!editing) return;
    const category = categories.find((c) => c.id === categoryId);
    const firstProduct = catalogProducts.find((p) => p.categoryId === categoryId);
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
    if (!editing.title || !editing.productId) { toast.error("Title and product are required"); return; }

    try {
      setBusy(true);

      if (editing.id) {
        await vendorOnboardingApi.updateVendorProductListing(user.id, editing.id, {
          vendorId: user.id,
          listingId: editing.id,
          productId: editing.productId,
          listingTitle: editing.title,
          dailyRent: editing.dailyRent,
          monthlyRent: editing.monthlyRent,
          securityDeposit: editing.securityDeposit,
          availableQuantity: editing.quantity,
          listingStatus: editing.status,
        });
      } else {
        await vendorOnboardingApi.createVendorProductListing(user.id, {
          vendorId: user.id,
          productId: editing.productId,
          listingTitle: editing.title,
          dailyRent: editing.dailyRent,
          monthlyRent: editing.monthlyRent,
          securityDeposit: editing.securityDeposit,
          availableQuantity: editing.quantity,
          listingStatus: editing.status,
        });
      }

      await loadCatalogAndListings();
      setEditing(null);
      toast.success("Listing saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save listing.";
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
      const message = error instanceof Error ? error.message : "Failed to create category.";
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
      const message = error instanceof Error ? error.message : "Failed to create product.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openMedia = async (p: LocalListing) => {
    if (!user) return;
    try {
      setBusy(true);
      const [imagesRes, docsRes] = await Promise.all([
        vendorOnboardingApi.getVendorProductImages(user.id, p.id),
        vendorOnboardingApi.getVendorProductDocuments(user.id, p.id),
      ]);

      setMediaFor(p);
      setTempImages(imagesRes
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((img) => ({
          id: img.id,
          primary: img.isPrimary,
          url: img.imageUrl,
          persisted: true,
        })));
      setListingDocuments(docsRes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load listing media.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const setPrimary = (id: string) => setTempImages((imgs) => imgs.map((i) => ({ ...i, primary: i.id === id })));
  const removeImg = async (id: string) => {
    if (!user || !mediaFor) return;
    const img = tempImages.find((i) => i.id === id);
    if (!img) return;

    if (!img.persisted) {
      setTempImages((imgs) => imgs.filter((i) => i.id !== id));
      return;
    }

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorProductImage(user.id, mediaFor.id, id);
      const imagesRes = await vendorOnboardingApi.getVendorProductImages(user.id, mediaFor.id);
      setTempImages(imagesRes
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((serverImg) => ({
          id: serverImg.id,
          primary: serverImg.isPrimary,
          url: serverImg.imageUrl,
          persisted: true,
        })));
      toast.success("Image deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image.";
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
          const fileResult = await vendorOnboardingApi.uploadVendorFile(user.id, file);
          return {
            id: `temp-${Date.now()}-${file.name}`,
            primary: false,
            url: fileResult.fileUrl,
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
      const message = error instanceof Error ? error.message : "Failed to upload image.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const reorder = (from: number, to: number) => setTempImages((imgs) => { const c = [...imgs]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  const previewImage = (url: string) => setPreviewUrl(url);

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
              imageUrl: img.url,
              displayOrder: tempImages.length + idx + 1,
              isPrimary: img.primary,
            })
          )
        );
      }
      toast.success("Media updated");
      setMediaFor(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save media.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const uploadListingDoc = async () => {
    if (!mediaFor || !user || !docFile) return;
    try {
      setBusy(true);
      const fileResult = await vendorOnboardingApi.uploadVendorFile(user.id, docFile);
      await vendorOnboardingApi.addVendorProductDocument(user.id, mediaFor.id, {
        vendorId: user.id,
        listingId: mediaFor.id,
        documentType: docType,
        fileUrl: fileResult.fileUrl,
      });
      const docs = await vendorOnboardingApi.getVendorProductDocuments(user.id, mediaFor.id);
      setListingDocuments(docs);
      setDocFile(null);
      if (docFileInputRef.current) {
        docFileInputRef.current.value = "";
      }
      toast.success("Listing document uploaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload listing document.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const viewListingDoc = (fileUrl: string) => {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const deleteListingDoc = async (documentId: string) => {
    if (!mediaFor || !user) return;

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorProductDocument(user.id, mediaFor.id, documentId);
      const docs = await vendorOnboardingApi.getVendorProductDocuments(user.id, mediaFor.id);
      setListingDocuments(docs);
      toast.success("Document deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete listing document.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your rental catalog. Add new listings, set pricing, and control availability."
        actions={
          <Button onClick={openNew} className="bg-gradient-primary shadow-glow" disabled={busy}>
            <Plus className="mr-2 h-4 w-4" /> New listing
          </Button>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {!hasLoaded && busy && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            Loading product listings...
          </div>
        )}
        {loadError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings…" className="pl-9" />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "active" | "inactive")}>
            <TabsList>
              <TabsTrigger value="all">All <span className="ml-1.5 text-xs text-muted-foreground">({products.length})</span></TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Listing</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Daily</th>
                <th className="px-4 py-3 font-semibold text-right">Monthly</th>
                <th className="px-4 py-3 font-semibold text-right">Deposit</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-soft">
                        <ImageIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.productName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{p.dailyRent}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{p.monthlyRent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">₹{p.securityDeposit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{p.quantity}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={p.status === "active"}
                      onCheckedChange={() => toggleListingStatus(p)}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => void openMedia(p)} aria-label="Media" disabled={busy}>
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Edit" disabled={busy}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {hasLoaded && !busy && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {products.length === 0
                      ? "No listings created yet."
                      : "No listings match your current search/filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{products.some((p) => p.id === editing?.id) ? "Edit listing" : "New listing"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
              <FormGrid cols={2}>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <div className="flex items-center gap-2">
                  <Select value={editing.categoryId} onValueChange={onCategoryChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {/* Vendor catalog creation disabled - managed by admin */}
                  {/* <Button variant="outline" onClick={openCreateCategory} type="button" disabled={busy}>New</Button> */}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Product (from catalog)</Label>
                <div className="flex items-center gap-2">
                  <Select value={editing.productId} onValueChange={(v) => {
                    const selected = catalogProducts.find((p) => p.id === v);
                    setEditing({
                      ...editing,
                      productId: v,
                      productName: selected?.name ?? "",
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                    <SelectContent>
                      {catalogProducts.filter((p) => p.categoryId === editing.categoryId).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Vendor catalog creation disabled - managed by admin */}
                  {/* <Button variant="outline" onClick={openCreateProduct} type="button" disabled={busy}>New</Button> */}
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Listing title</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="E.g. Sony A7 III — Daily Rental" />
              </div>
              <div className="space-y-1.5">
                <Label>Daily rent (₹)</Label>
                <Input type="number" value={editing.dailyRent} onChange={(e) => setEditing({ ...editing, dailyRent: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly rent (₹)</Label>
                <Input type="number" value={editing.monthlyRent} onChange={(e) => setEditing({ ...editing, monthlyRent: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Security deposit (₹)</Label>
                <Input type="number" value={editing.securityDeposit} onChange={(e) => setEditing({ ...editing, securityDeposit: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} />
              </div>
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
            <Button onClick={() => void save()} disabled={busy}>Save listing</Button>
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
        <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl p-0">
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
                  <h3 className="mb-3 font-medium">Listing documents</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto]">
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spec_sheet">Spec Sheet</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      ref={docFileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                    <Button onClick={() => void uploadListingDoc()} disabled={busy || !docFile}>Upload</Button>
                  </div>
                  {docFile && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected: <span className="font-medium">{docFile.name}</span>
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    {listingDocuments.map((doc) => (
                      <div key={doc.id} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">{doc.documentType}</p>
                          <p className="truncate text-xs text-muted-foreground">{doc.fileUrl.split("/").pop()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={doc.verificationStatus === "approved" ? "approved" : doc.verificationStatus === "rejected" ? "rejected" : "pending"} />
                          <Button variant="ghost" size="icon" onClick={() => viewListingDoc(doc.fileUrl)} aria-label="View document" disabled={busy}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => void deleteListingDoc(doc.id)} aria-label="Delete document" disabled={busy}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {listingDocuments.length === 0 && (
                      <p className="text-xs text-muted-foreground">No listing documents uploaded yet.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="border-t px-4 py-3 sm:px-6">
            <Button variant="outline" onClick={() => setMediaFor(null)} disabled={busy}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <Button onClick={() => void saveMedia()} disabled={busy}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img src={previewUrl} alt="Preview" className="max-h-[70vh] w-full object-contain bg-muted/20" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewUrl(null)}>
              <X className="mr-2 h-4 w-4" /> Close
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
  persisted: boolean;
}

interface ListingDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  verificationStatus: string;
}
