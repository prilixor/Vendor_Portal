import { useState, useEffect, useRef, useMemo } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { FileUploadZone } from "@/app/components/shared/FileUploadZone";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Textarea } from "@/app/components/ui/textarea";
import { adminApi, ProductCategoryDto, ProductDto, ProductImageDto, CreateProductCategoryRequest, UpdateProductCategoryRequest, CreateProductRequest, UpdateProductRequest } from "@/app/services/adminApi";
import { Plus, Search, Pencil, Trash2, Upload, Package, FolderTree, Loader2, Download, FileDown, Database, ChevronDown, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

const PAGE_SIZE = 10;
const PRODUCT_FORM_STEPS = ["Basic", "Pricing", "Tax & images"] as const;

const ProductManagement = () => {
  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("categories");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [categoryPage, setCategoryPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategoryDto | null>(null);
  const [categoryForm, setCategoryForm] = useState<CreateProductCategoryRequest>({
    categoryName: "",
    prescriptionRequired: false,
    depositRequired: false,
    installationRequired: false,
    isChemical: false,
    isActive: true,
  });
  
  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productFormStep, setProductFormStep] = useState(0);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [productForm, setProductForm] = useState<CreateProductRequest>({
    categoryId: "",
    productName: "",
    brandName: "",
    modelName: "",
    shortDescription: "",
    longDescription: "",
    dailyRent: 0,
    monthlyRent: 0,
    securityDeposit: 0,
    buyPrice: undefined,
    gstPercent: 18,
    isRentEnabled: true,
    isBuyEnabled: true,
    isActive: true,
  });
  const [productImages, setProductImages] = useState<ProductImageDto[]>([]);
  const [productImagesLoading, setProductImagesLoading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageIsPrimary, setNewImageIsPrimary] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Excel upload state
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Status confirmation state
  const [statusConfirmId, setStatusConfirmId] = useState<string | null>(null);
  const [statusConfirmAction, setStatusConfirmAction] = useState<'activate' | 'deactivate' | null>(null);

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Category confirmation state
  const [categoryStatusConfirmId, setCategoryStatusConfirmId] = useState<string | null>(null);
  const [categoryStatusConfirmAction, setCategoryStatusConfirmAction] = useState<'activate' | 'deactivate' | null>(null);
  const [categoryDeleteConfirmId, setCategoryDeleteConfirmId] = useState<string | null>(null);

  const isChemical = false; // Add this line to fix the ReferenceError

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        adminApi.getProductCategories(),
        adminApi.getProducts(),
      ]);
      setCategories(categoriesRes);
      setProducts(productsRes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load catalog data.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) => {
    const isChem = c.isChemical;
    if (isChem) return false;

    const matchesSearch = !search || c.categoryName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? c.isActive : !c.isActive);
    return matchesSearch && matchesStatus;
  });

  const chemicalCategoryIds = new Set(categories.filter((c) => c.isChemical).map((c) => c.id));
  const isChemicalProduct = (p: ProductDto) =>
    chemicalCategoryIds.has(p.categoryId) ||
    !!p.baseUnit ||
    !!p.casNumber ||
    !!p.chemicalFormula;

  const filteredProducts = products.filter((p) => {
    if (isChemicalProduct(p)) return false; // Hide chemicals in Equipment tab

    const matchesSearch = !search || 
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.brandName?.toLowerCase().includes(search.toLowerCase()) ||
      p.modelName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? p.isActive : !p.isActive);
    const matchesFavorites = !showFavoritesOnly || p.favoriteCount > 0;
    return matchesSearch && matchesStatus && matchesFavorites;
  });

  useEffect(() => {
    setCategoryPage(1);
    setProductPage(1);
  }, [search, statusFilter, showFavoritesOnly, activeTab]);

  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [filteredCategories, categoryPage]);

  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, productPage]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.categoryName || "Unknown";
  };

  const toggleCategoryStatus = async (id: string, currentStatus: boolean) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    const newStatus = !currentStatus;
    setCategoryStatusConfirmId(id);
    setCategoryStatusConfirmAction(newStatus ? 'activate' : 'deactivate');
  };

  const confirmCategoryStatusChange = async (id: string, action: 'activate' | 'deactivate') => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    try {
      setLoading(true);
      const updated = await adminApi.updateProductCategory(id, {
        id,
        categoryName: category.categoryName,
        prescriptionRequired: category.prescriptionRequired,
        depositRequired: category.depositRequired,
        installationRequired: category.installationRequired,
        isChemical: category.isChemical,
        isActive: action === 'activate',
      });

      setCategories(categories.map((c) => (c.id === id ? updated : c)));
      toast.success(`Category ${action}d successfully`);
      setCategoryStatusConfirmId(null);
      setCategoryStatusConfirmAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update category status.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newStatus = !currentStatus;
    setStatusConfirmId(id);
    setStatusConfirmAction(newStatus ? 'activate' : 'deactivate');
  };

  const confirmStatusChange = async (id: string, action: 'activate' | 'deactivate') => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    try {
      setLoading(true);
      const updated = await adminApi.updateProduct(id, {
        id,
        categoryId: product.categoryId,
        productName: product.productName,
        brandName: product.brandName,
        modelName: product.modelName,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        dailyRent: product.dailyRent,
        monthlyRent: product.monthlyRent,
        securityDeposit: product.securityDeposit,
        buyPrice: product.buyPrice,
        gstPercent: product.gstPercent,
        isRentEnabled: product.isRentEnabled,
        isBuyEnabled: product.isBuyEnabled,
        isActive: action === 'activate',
      });

      setProducts(products.map((p) => (p.id === id ? updated : p)));
      toast.success(`Product ${action}d successfully`);
      setStatusConfirmId(null);
      setStatusConfirmAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update product status.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const openCategoryDialog = (category?: ProductCategoryDto) => {
    setFieldErrors({});
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        categoryName: category.categoryName,
        prescriptionRequired: category.prescriptionRequired,
        depositRequired: category.depositRequired,
        installationRequired: category.installationRequired,
        isChemical: category.isChemical,
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        categoryName: "",
        prescriptionRequired: false,
        depositRequired: false,
        installationRequired: false,
        isChemical: false,
        isActive: true,
      });
    }
    setCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    const errors: Record<string, string> = {};
    if (!categoryForm.categoryName?.trim()) {
      errors.categoryName = "Please enter a category name.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});
      if (editingCategory) {
        await adminApi.updateProductCategory(editingCategory.id, {
          ...categoryForm,
          categoryName: categoryForm.categoryName.trim(),
          id: editingCategory.id,
        });
        toast.success("Category updated");
      } else {
        await adminApi.createProductCategory({
          ...categoryForm,
          categoryName: categoryForm.categoryName.trim(),
        });
        toast.success("Category created");
      }
      setCategoryDialogOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save category.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    // Show confirmation
    setCategoryDeleteConfirmId(id);
  };

  const confirmCategoryDelete = async (id: string) => {
    try {
      setLoading(true);
      await adminApi.deleteProductCategory(id);
      toast.success("Category deleted");
      await loadData();
      setCategoryDeleteConfirmId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete category.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadProductImages = async (productId: string, silent = false) => {
    try {
      setProductImagesLoading(true);
      const images = await adminApi.getProductImages(productId);
      setProductImages(images);
      setNewImageIsPrimary(images.length === 0);
    } catch (error) {
      if (!silent) {
        const message = error instanceof Error ? error.message : "Failed to load product images.";
        toast.error(message);
      }
      setProductImages([]);
    } finally {
      setProductImagesLoading(false);
    }
  };

  const validateProductStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    if (step === 0) {
      if (!productForm.categoryId?.trim()) {
        errors.categoryId = "Please select an equipment category.";
      }
      if (!productForm.productName?.trim()) {
        errors.productName = "Please enter a product name.";
      }
    }
    if (step === 1) {
      if (productForm.isRentEnabled && !(productForm.dailyRent > 0 || productForm.monthlyRent > 0)) {
        errors.dailyRent = "Enter daily or monthly rent when rent is enabled.";
      }
    }
    if (step === 2) {
      if (productForm.gstPercent == null || Number.isNaN(Number(productForm.gstPercent))) {
        errors.gstPercent = "Please enter GST %.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      toast.error("Please fill in the required fields.");
      return false;
    }
    return true;
  };

  const openProductDialog = (product?: ProductDto) => {
    setFieldErrors({});
    setProductFormStep(0);
    if (product) {
      setEditingProduct(product);
      setProductForm({
        categoryId: product.categoryId,
        productName: product.productName,
        brandName: product.brandName,
        modelName: product.modelName,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        dailyRent: product.dailyRent,
        monthlyRent: product.monthlyRent,
        securityDeposit: product.securityDeposit,
        buyPrice: product.buyPrice,
        vendorDailyRent: product.vendorDailyRent || 0,
        vendorMonthlyRent: product.vendorMonthlyRent || 0,
        vendorSecurityDeposit: product.vendorSecurityDeposit || 0,
        vendorBuyPrice: product.vendorBuyPrice,
        gstPercent: product.gstPercent,
        isRentEnabled: product.isRentEnabled,
        isBuyEnabled: product.isBuyEnabled,
        isActive: product.isActive,
      });
      void loadProductImages(product.id, true);
    } else {
      setEditingProduct(null);
      const equipmentCategories = categories.filter((c) => !c.isChemical);
      setProductForm({
        categoryId: equipmentCategories[0]?.id || "",
        productName: "",
        brandName: "",
        modelName: "",
        shortDescription: "",
        longDescription: "",
        dailyRent: 0,
        monthlyRent: 0,
        securityDeposit: 0,
        buyPrice: undefined,
        vendorDailyRent: 0,
        vendorMonthlyRent: 0,
        vendorSecurityDeposit: 0,
        vendorBuyPrice: undefined,
        gstPercent: 18,
        isRentEnabled: true,
        isBuyEnabled: true,
        isActive: true,
      });
      setProductImages([]);
      setNewImageUrl("");
      setNewImageIsPrimary(false);
    }
    setProductDialogOpen(true);
  };

  const addProductImageFromValue = async (imageRef: string) => {
    if (!editingProduct) {
      toast.error("Save product first, then add images.");
      return;
    }

    const normalized = imageRef.trim();
    if (!normalized) {
      toast.error("Please enter image URL or upload an image.");
      return;
    }

    try {
      setProductImagesLoading(true);
      await adminApi.addProductImage(editingProduct.id, {
        imageUrl: normalized,
        displayOrder: Math.max(1, productImages.length + 1),
        isPrimary: newImageIsPrimary || productImages.length === 0,
      });
      setNewImageUrl("");
      await loadProductImages(editingProduct.id);
      toast.success("Product image added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add product image.";
      toast.error(message);
    } finally {
      setProductImagesLoading(false);
    }
  };

  const handleProductImageUpload = async (file?: File) => {
    if (!file) return;
    if (!editingProduct) {
      toast.error("Save product first, then upload images.");
      return;
    }

    try {
      setUploadingImage(true);
      const upload = await adminApi.uploadProductImageFile(file);
      await addProductImageFromValue(upload.storageKey?.trim() || upload.fileUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload image.";
      toast.error(message);
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteProductImage = async (imageId: string) => {
    if (!editingProduct) return;
    try {
      setProductImagesLoading(true);
      await adminApi.deleteProductImage(editingProduct.id, imageId);
      await loadProductImages(editingProduct.id);
      toast.success("Product image deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete product image.";
      toast.error(message);
    } finally {
      setProductImagesLoading(false);
    }
  };

  const setPrimaryProductImage = async (imageId: string) => {
    if (!editingProduct) return;
    try {
      setProductImagesLoading(true);
      await adminApi.setPrimaryProductImage(editingProduct.id, imageId);
      await loadProductImages(editingProduct.id);
      toast.success("Primary image updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set primary image.";
      toast.error(message);
    } finally {
      setProductImagesLoading(false);
    }
  };

  const saveProduct = async () => {
    const errors: Record<string, string> = {};
    if (!productForm.categoryId?.trim()) {
      errors.categoryId = "Please select an equipment category.";
    }
    if (!productForm.productName?.trim()) {
      errors.productName = "Please enter a product name.";
    }
    if (productForm.isRentEnabled && !(productForm.dailyRent > 0 || productForm.monthlyRent > 0)) {
      errors.dailyRent = "Enter daily or monthly rent when rent is enabled.";
    }
    if (productForm.gstPercent == null || Number.isNaN(Number(productForm.gstPercent))) {
      errors.gstPercent = "Please enter GST %.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.categoryId || errors.productName) setProductFormStep(0);
      else if (errors.dailyRent) setProductFormStep(1);
      else setProductFormStep(2);
      toast.error("Please fill in the required fields.");
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});
      
      const payload = {
        ...productForm,
        productName: productForm.productName.trim(),
        categoryId: productForm.categoryId.trim(),
      };

      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, {
          ...payload,
          id: editingProduct.id,
        });
        toast.success("Product updated");
      } else {
        await adminApi.createProduct(payload);
        toast.success("Product created");
      }
      setProductDialogOpen(false);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save product.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    // If already confirming for this product, execute the deletion
    if (deleteConfirmId === id) {
      try {
        setLoading(true);
        await adminApi.deleteProduct(id);
        toast.success("Product deleted");
        await loadData();
        setDeleteConfirmId(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete product.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else {
      // Show confirmation
      setDeleteConfirmId(id);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      setLoading(true);
      await adminApi.deleteProduct(id);
      toast.success("Product deleted");
      await loadData();
      setDeleteConfirmId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete product.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const uploadExcelFile = async (file: File) => {
    try {
      setLoading(true);
      const result = await adminApi.uploadCatalogExcel(file, false);
      
      if (result.success) {
        toast.success(`Excel uploaded successfully: ${result.categoriesCreated} categories, ${result.productsCreated} products created.`);
        await loadData();
      } else {
        toast.error(`Excel upload failed with ${result.errors.length} errors.`);
        result.errors.forEach((error) => {
          console.error(`Row ${error.row} (${error.sheet}): ${error.field} - ${error.message}`);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload Excel.";
      toast.error(message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const downloadSampleExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const categoriesHeaders = [
        ["category_name", "prescription_required", "deposit_required", "installation_required", "is_active"]
      ];
      const categoriesWs = XLSX.utils.aoa_to_sheet(categoriesHeaders);
      XLSX.utils.book_append_sheet(wb, categoriesWs, "Categories");

      const productsHeaders = [
        ["category_name", "product_name", "brand_name", "model_name", "short_description", "long_description", "daily_rent", "monthly_rent", "security_deposit", "buy_price", "gst_percent", "is_rent_enabled", "is_buy_enabled", "is_active", "vendor_daily_rent", "vendor_monthly_rent", "vendor_security_deposit", "vendor_buy_price"]
      ];
      
      const productsWs = XLSX.utils.aoa_to_sheet(productsHeaders);
      XLSX.utils.book_append_sheet(wb, productsWs, "Products");

      XLSX.writeFile(wb, `catalog_template_equipment.xlsx`);
      toast.success("Sample template downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template.";
      toast.error(message);
    }
  };

  const downloadExistingData = async () => {
    try {
      setLoading(true);
      await adminApi.downloadCatalogExcel(false);
      toast.success("Catalog data downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download catalog data.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const renderProductGrid = () => (
    loading ? (
      <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0 animate-pulse">
        <table className="w-full min-w-[700px] sm:min-w-[800px] text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-32" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-24" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-20" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-20" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-12" /></th>
              <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
              <th className="px-4 py-3 font-semibold text-center"><Skeleton className="h-3 w-12 mx-auto" /></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                {activeTab === "equipment" && <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>}
                <td className="px-4 py-3"><Skeleton className="h-6 w-12 rounded" /></td>
                <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                <td className="px-4 py-3"><Skeleton className="h-6 w-12 rounded" /></td>
                <td className="px-4 py-3 text-center"><Skeleton className="h-6 w-12 rounded mx-auto" /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <>
      <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0">
        <table className="w-full min-w-[700px] sm:min-w-[800px] text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Product Name</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Brand</th>
              {activeTab === "equipment" && <th className="px-4 py-3 font-semibold">Model</th>}
              <th className="px-4 py-3 font-semibold">{activeTab === "equipment" ? "Daily" : "Buy Price"}</th>
              <th className="px-4 py-3 font-semibold">GST %</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-center">Favorites</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedProducts.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{p.productName}</td>
                <td className="px-4 py-3 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                <td className="px-4 py-3">{p.brandName || "-"}</td>
                {activeTab === "equipment" && <td className="px-4 py-3">{p.modelName || "-"}</td>}
                <td className="px-4 py-3">₹{(activeTab === "equipment" ? p.dailyRent : (p.buyPrice || 0)).toFixed(0)}</td>
                <td className="px-4 py-3">{p.gstPercent.toFixed(0)}%</td>
                <td className="px-4 py-3">
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={() => toggleProductStatus(p.id, p.isActive)}
                    disabled={loading}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {p.favoriteCount > 0 ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center justify-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                            ❤️ {p.favoriteCount}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Favorited by {p.favoriteCount} {p.favoriteCount === 1 ? 'customer' : 'customers'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openProductDialog(p)} disabled={loading}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)} disabled={loading}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={activeTab === "equipment" ? 9 : 8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && (
        <TablePagination
          page={productPage}
          pageSize={PAGE_SIZE}
          total={filteredProducts.length}
          onPageChange={setProductPage}
          label="products"
        />
      )}
    </>
    )
  );

  return (
    <div>
      <PageHeader
        title="Products Management"
        description="Manage product categories and products for the marketplace catalog."
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-border pb-4">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
              <TabsTrigger value="categories" className="text-xs sm:text-sm">
                <FolderTree className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Categories</span>
                <span className="hidden sm:inline ml-1">({categories.filter(c => !c.isChemical).length})</span>
              </TabsTrigger>
              <TabsTrigger value="equipment" className="text-xs sm:text-sm">
                <Package className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Equipment</span>
                <span className="hidden sm:inline ml-1">({products.filter((p) => !isChemicalProduct(p)).length})</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 sm:mt-0 flex gap-2 w-full sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={loading} className="w-full sm:w-auto justify-center">
                    <Download className="mr-2 h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Download Excel</span>
                    <span className="sm:hidden">Download</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-auto max-w-sm">
                  <DropdownMenuItem onClick={downloadSampleExcel}>
                    <FileDown className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Download Sample Excel</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadExistingData}>
                    <Database className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Download Existing Data Excel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={() => setExcelDialogOpen(true)} disabled={loading} className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Upload Excel</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between -mx-4 sm:-mx-6 lg:-mx-8 border-b border-border bg-muted/10 mb-4 px-4 sm:px-6 lg:px-8">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="pl-9 w-full"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {activeTab === "equipment" && (
                <div className="flex items-center space-x-2 mr-2">
                  <Switch id="favorites-only" checked={showFavoritesOnly} onCheckedChange={setShowFavoritesOnly} />
                  <Label htmlFor="favorites-only" className="text-sm cursor-pointer whitespace-nowrap">Favorites Only</Label>
                </div>
              )}
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => activeTab === "categories" ? openCategoryDialog() : openProductDialog()} disabled={loading} className="w-full sm:w-auto whitespace-nowrap">
                <Plus className="mr-2 h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">New {activeTab === "categories" ? "Category" : "Equipment"}</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>

          <TabsContent value="categories" className="mt-4">
            {loading ? (
              <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0 animate-pulse">
                <table className="w-full min-w-[700px] sm:min-w-[800px] text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-32" /></th>
                      <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-24" /></th>
                      <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
                      <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-20" /></th>
                      <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-6 w-12 rounded" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Skeleton className="h-8 w-8 rounded" />
                            <Skeleton className="h-8 w-8 rounded" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0">
                <table className="w-full min-w-[700px] sm:min-w-[800px] text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Category Name</th>
                      <th className="px-4 py-3 font-semibold">Prescription</th>
                      <th className="px-4 py-3 font-semibold">Deposit</th>
                      <th className="px-4 py-3 font-semibold">Installation</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedCategories.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{c.categoryName}</td>
                        <td className="px-4 py-3">{c.prescriptionRequired ? "Yes" : "No"}</td>
                        <td className="px-4 py-3">{c.depositRequired ? "Yes" : "No"}</td>
                        <td className="px-4 py-3">{c.installationRequired ? "Yes" : "No"}</td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={c.isActive}
                            onCheckedChange={() => toggleCategoryStatus(c.id, c.isActive)}
                            disabled={loading}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openCategoryDialog(c)} disabled={loading}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteCategory(c.id)} disabled={loading}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCategories.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No categories found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && (
              <TablePagination
                page={categoryPage}
                pageSize={PAGE_SIZE}
                total={filteredCategories.length}
                onPageChange={setCategoryPage}
                label="categories"
              />
            )}
          </TabsContent>

          <TabsContent value="equipment" className="mt-4">
            {renderProductGrid()}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Delete Confirmation Card */}
      {deleteConfirmId && (() => {
        const product = products.find(p => p.id === deleteConfirmId);
        if (!product) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Delete Product</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">Are you sure you want to delete this product?</p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{product.productName}</p>
                  <p className="text-xs text-muted-foreground">{getCategoryName(product.categoryId)}</p>
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
                  onClick={() => confirmDelete(deleteConfirmId)}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="mr-2 h-4 w-4" /> Delete Product</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {/* Status Confirmation Card */}
      {statusConfirmId && statusConfirmAction && (() => {
        const product = products.find(p => p.id === statusConfirmId);
        if (!product) return null;
        const isActivating = statusConfirmAction === 'activate';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActivating ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {isActivating ? (
                    <Package className="h-5 w-5 text-green-600" />
                  ) : (
                    <Package className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {isActivating ? 'Activate Product' : 'Deactivate Product'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isActivating ? 'This will make the product available for vendors' : 'This will hide the product from vendors'}
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to {isActivating ? 'activate' : 'deactivate'} this product?
                </p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{product.productName}</p>
                  <p className="text-xs text-muted-foreground">{getCategoryName(product.categoryId)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${product.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs text-muted-foreground">
                      Currently: {product.isActive ? 'Active' : 'Inactive'}
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
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isActivating ? 'Activating...' : 'Deactivating...'}</>
                  ) : (
                    <><Package className="mr-2 h-4 w-4" /> {isActivating ? 'Activate Product' : 'Deactivate Product'}</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {/* Category Status Confirmation Card */}
      {categoryStatusConfirmId && categoryStatusConfirmAction && (() => {
        const category = categories.find(c => c.id === categoryStatusConfirmId);
        if (!category) return null;
        const isActivating = categoryStatusConfirmAction === 'activate';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActivating ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {isActivating ? (
                    <FolderTree className="h-5 w-5 text-green-600" />
                  ) : (
                    <FolderTree className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {isActivating ? 'Activate Category' : 'Deactivate Category'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isActivating ? 'This will make the category and its products available for vendors' : 'This will hide the category and all its products from vendors'}
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">
                  Are you sure you want to {isActivating ? 'activate' : 'deactivate'} this category?
                </p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{category.categoryName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${category.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-xs text-muted-foreground">
                      Currently: {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCategoryStatusConfirmId(null);
                    setCategoryStatusConfirmAction(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant={isActivating ? 'default' : 'secondary'}
                  onClick={() => confirmCategoryStatusChange(categoryStatusConfirmId, categoryStatusConfirmAction)}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isActivating ? 'Activating...' : 'Deactivating...'}</>
                  ) : (
                    <><FolderTree className="mr-2 h-4 w-4" /> {isActivating ? 'Activate Category' : 'Deactivate Category'}</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {/* Category Delete Confirmation Card */}
      {categoryDeleteConfirmId && (() => {
        const category = categories.find(c => c.id === categoryDeleteConfirmId);
        if (!category) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Delete Category</h3>
                  <p className="text-sm text-muted-foreground">This will also delete all products in this category</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-2">Are you sure you want to delete this category?</p>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="font-medium text-sm">{category.categoryName}</p>
                  <p className="text-xs text-muted-foreground">
                    {products.filter(p => p.categoryId === category.id).length} products will be deleted
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setCategoryDeleteConfirmId(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => confirmCategoryDelete(categoryDeleteConfirmId)}
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="mr-2 h-4 w-4" /> Delete Category</>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={1}>
              <div className="space-y-1.5">
                <Label required>Category Name</Label>
                <Input
                  value={categoryForm.categoryName}
                  onChange={(e) => {
                    setCategoryForm({ ...categoryForm, categoryName: e.target.value });
                    clearFieldError("categoryName");
                  }}
                  placeholder="E.g. Home Appliances"
                  className={fieldErrors.categoryName ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.categoryName} />
                <p className="text-[11px] text-muted-foreground">Required. Used to group equipment in the catalog.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="prescription"
                  checked={categoryForm.prescriptionRequired}
                  onChange={(e) => setCategoryForm({ ...categoryForm, prescriptionRequired: e.target.checked })}
                />
                <Label htmlFor="prescription">Prescription Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deposit"
                  checked={categoryForm.depositRequired}
                  onChange={(e) => setCategoryForm({ ...categoryForm, depositRequired: e.target.checked })}
                />
                <Label htmlFor="deposit">Deposit Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="installation"
                  checked={categoryForm.installationRequired}
                  onChange={(e) => setCategoryForm({ ...categoryForm, installationRequired: e.target.checked })}
                />
                <Label htmlFor="installation">Installation Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </FormGrid>
            <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={saveCategory} disabled={loading}>
              {editingCategory ? "Update" : "Create"} Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setProductFormStep(0);
        }}
      >
        <DialogContent className="flex max-h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-4 pr-12 sm:px-6 text-left">
            <DialogTitle>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
            <div className="flex items-center gap-1.5 pt-3">
              {PRODUCT_FORM_STEPS.map((label, idx) => {
                const active = productFormStep === idx;
                const done = productFormStep > idx;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (idx < productFormStep) setProductFormStep(idx);
                      else if (idx > productFormStep) {
                        for (let s = productFormStep; s < idx; s++) {
                          if (!validateProductStep(s)) return;
                        }
                        setProductFormStep(idx);
                      }
                    }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/10 text-[10px] font-semibold">
                      {idx + 1}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 space-y-4">
            {productFormStep === 0 && (
            <section className="rounded-lg border border-border p-3 sm:p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Basic details</h4>
              <FormGrid cols={2}>
                <div className="space-y-1.5">
                  <Label required>Category</Label>
                  <Select
                    value={productForm.categoryId}
                    onValueChange={(v) => {
                      setProductForm({ ...productForm, categoryId: v });
                      clearFieldError("categoryId");
                    }}
                  >
                    <SelectTrigger className={fieldErrors.categoryId ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select equipment category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => !c.isChemical).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={fieldErrors.categoryId} />
                </div>
                <div className="space-y-1.5">
                  <Label required>Product Name</Label>
                  <Input
                    value={productForm.productName}
                    onChange={(e) => {
                      setProductForm({ ...productForm, productName: e.target.value });
                      clearFieldError("productName");
                    }}
                    placeholder="E.g. Oxygen Concentrator"
                    className={fieldErrors.productName ? "border-destructive" : ""}
                  />
                  <FieldError message={fieldErrors.productName} />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Input
                    value={productForm.brandName || ""}
                    onChange={(e) => setProductForm({ ...productForm, brandName: e.target.value })}
                    placeholder="E.g. IFB"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Input
                    value={productForm.modelName || ""}
                    onChange={(e) => setProductForm({ ...productForm, modelName: e.target.value })}
                    placeholder="E.g. Senator Plus SX"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Short Description</Label>
                  <Input
                    value={productForm.shortDescription || ""}
                    onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
                    placeholder="One-line summary shown in catalog listings"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Long Description</Label>
                  <Textarea
                    value={productForm.longDescription || ""}
                    onChange={(e) => setProductForm({ ...productForm, longDescription: e.target.value })}
                    placeholder="Full product details for customers"
                    rows={3}
                  />
                </div>
              </FormGrid>
            </section>
            )}

            {productFormStep === 1 && (
            <>
            <section className="rounded-lg border border-indigo-100 dark:border-indigo-950/40 bg-indigo-50/30 dark:bg-indigo-950/10 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Customer pricing</h4>
                <p className="text-xs text-muted-foreground">What customers see and pay on the marketplace.</p>
              </div>
              <FormGrid cols={2}>
                <div className="space-y-1.5">
                  <Label required={productForm.isRentEnabled}>Daily Rent (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.dailyRent}
                    onChange={(e) => {
                      setProductForm({ ...productForm, dailyRent: Number(e.target.value) || 0 });
                      clearFieldError("dailyRent");
                    }}
                    className={fieldErrors.dailyRent ? "border-destructive" : ""}
                  />
                  <FieldError message={fieldErrors.dailyRent} />
                  <p className="text-[11px] text-muted-foreground">Required when Rent is enabled (or set Monthly Rent).</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly Rent (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.monthlyRent}
                    onChange={(e) => setProductForm({ ...productForm, monthlyRent: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Security Deposit (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.securityDeposit}
                    onChange={(e) => setProductForm({ ...productForm, securityDeposit: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Buy Price (INR, optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.buyPrice ?? ""}
                    onChange={(e) => setProductForm({ ...productForm, buyPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="Leave empty if buy not offered"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={productForm.isRentEnabled}
                      onChange={(e) => setProductForm({ ...productForm, isRentEnabled: e.target.checked })}
                    />
                    Rent enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={productForm.isBuyEnabled}
                      onChange={(e) => setProductForm({ ...productForm, isBuyEnabled: e.target.checked })}
                    />
                    Buy enabled
                  </label>
                </div>
              </FormGrid>
            </section>

            <section className="rounded-lg border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Vendor payout pricing</h4>
                <p className="text-xs text-muted-foreground">Admin-set amounts paid out to the vendor.</p>
              </div>
              <FormGrid cols={2}>
                <div className="space-y-1.5">
                  <Label>Vendor Daily Rent (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.vendorDailyRent}
                    onChange={(e) => setProductForm({ ...productForm, vendorDailyRent: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vendor Monthly Rent (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.vendorMonthlyRent}
                    onChange={(e) => setProductForm({ ...productForm, vendorMonthlyRent: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vendor Security Deposit (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.vendorSecurityDeposit}
                    onChange={(e) => setProductForm({ ...productForm, vendorSecurityDeposit: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vendor Buy Price (INR, optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.vendorBuyPrice ?? ""}
                    onChange={(e) => setProductForm({ ...productForm, vendorBuyPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
              </FormGrid>
            </section>
            </>
            )}

            {productFormStep === 2 && (
            <>
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Tax & availability</h4>
              <FormGrid cols={2}>
                <div className="space-y-1.5">
                  <Label required>GST %</Label>
                  <Input
                    type="number"
                    min={0}
                    value={productForm.gstPercent}
                    onChange={(e) => {
                      setProductForm({ ...productForm, gstPercent: Number(e.target.value) || 0 });
                      clearFieldError("gstPercent");
                    }}
                    className={fieldErrors.gstPercent ? "border-destructive" : ""}
                  />
                  <FieldError message={fieldErrors.gstPercent} />
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={productForm.isActive}
                      onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                    />
                    Active in catalog
                  </label>
                </div>
              </FormGrid>
            </section>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">Product Images</Label>
                  {!editingProduct && (
                    <span className="text-xs text-muted-foreground">Save product first, then reopen to add images</span>
                  )}
                </div>

                {editingProduct ? (
                  <>
                    <FileUploadZone
                      accept="image/*"
                      label="Upload image"
                      hint="PNG, JPG, JPEG, WEBP"
                      showPreview={false}
                      loading={uploadingImage}
                      disabled={uploadingImage || productImagesLoading}
                      onFilesSelected={(files) => void handleProductImageUpload(files[0])}
                    />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <Input
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="Paste image URL or storage key"
                        disabled={uploadingImage || productImagesLoading}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={newImageIsPrimary}
                          onChange={(e) => setNewImageIsPrimary(e.target.checked)}
                          disabled={uploadingImage || productImagesLoading}
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void addProductImageFromValue(newImageUrl)}
                        disabled={uploadingImage || productImagesLoading}
                      >
                        Add
                      </Button>
                    </div>

                    {productImagesLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : productImages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No product images added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {productImages.map((img, index) => (
                          <div key={img.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                            <img
                              src={img.imageUrl}
                              alt=""
                              className="h-12 w-12 rounded object-cover bg-muted"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs">{img.imageUrl}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Order: {img.displayOrder} {img.isPrimary ? "• Primary" : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!img.isPrimary && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void setPrimaryProductImage(img.id)}
                                  disabled={uploadingImage || productImagesLoading}
                                >
                                  Set primary
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void deleteProductImage(img.id)}
                                disabled={uploadingImage || productImagesLoading}
                                aria-label={`Delete image ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Create the product first, then reopen to manage images.</p>
                )}
              </div>
            </>
            )}
          </div>
          <DialogFooter className="shrink-0 mt-0 border-t border-border bg-background px-4 py-3 sm:px-6 sm:justify-between">
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <div className="flex flex-wrap gap-2">
              {productFormStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => setProductFormStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </Button>
              )}
              {productFormStep < PRODUCT_FORM_STEPS.length - 1 ? (
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (!validateProductStep(productFormStep)) return;
                    setProductFormStep((s) => s + 1);
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button onClick={saveProduct} disabled={loading}>
                  {editingProduct ? "Update" : "Create"} Product
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Excel</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <p className="text-sm text-muted-foreground mb-4">
              Upload an Excel file with two sheets: "Categories" and "Products".<br />
              <strong>Need a template?</strong> Use the "Download Sample Excel" option above to get started.
            </p>
            <FileUploadZone
              accept=".xlsx,.xls"
              label="Excel file"
              hint="XLSX or XLS format"
              showPreview={false}
              loading={loading}
              disabled={loading}
              inputRef={fileInputRef}
              onFilesSelected={(files) => void uploadExcelFile(files[0])}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcelDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
