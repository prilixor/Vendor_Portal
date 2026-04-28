import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { adminApi, ProductCategoryDto, ProductDto, CreateProductCategoryRequest, UpdateProductCategoryRequest, CreateProductRequest, UpdateProductRequest } from "@/app/services/adminApi";
import { Plus, Search, Pencil, Trash2, Upload, Package, FolderTree, Loader2, Download, FileDown, Database, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

const ProductManagement = () => {
  const [categories, setCategories] = useState<ProductCategoryDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("categories");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategoryDto | null>(null);
  const [categoryForm, setCategoryForm] = useState<CreateProductCategoryRequest>({
    categoryName: "",
    prescriptionRequired: false,
    depositRequired: false,
    installationRequired: false,
    isActive: true,
  });
  
  // Product dialog state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [productForm, setProductForm] = useState<CreateProductRequest>({
    categoryId: "",
    productName: "",
    brandName: "",
    modelName: "",
    shortDescription: "",
    longDescription: "",
    isActive: true,
  });
  
  // Excel upload state
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const matchesSearch = !search || c.categoryName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? c.isActive : !c.isActive);
    return matchesSearch && matchesStatus;
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !search || 
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.brandName?.toLowerCase().includes(search.toLowerCase()) ||
      p.modelName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? p.isActive : !p.isActive);
    return matchesSearch && matchesStatus;
  });

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.categoryName || "Unknown";
  };

  const toggleCategoryStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const category = categories.find((c) => c.id === id);
      if (!category) return;

      const updated = await adminApi.updateProductCategory(id, {
        id,
        categoryName: category.categoryName,
        prescriptionRequired: category.prescriptionRequired,
        depositRequired: category.depositRequired,
        installationRequired: category.installationRequired,
        isActive: !currentStatus,
      });

      setCategories(categories.map((c) => (c.id === id ? updated : c)));
      toast.success("Category status updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update category status.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const product = products.find((p) => p.id === id);
      if (!product) return;

      const updated = await adminApi.updateProduct(id, {
        id,
        categoryId: product.categoryId,
        productName: product.productName,
        brandName: product.brandName,
        modelName: product.modelName,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        isActive: !currentStatus,
      });

      setProducts(products.map((p) => (p.id === id ? updated : p)));
      toast.success("Product status updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update product status.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const openCategoryDialog = (category?: ProductCategoryDto) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        categoryName: category.categoryName,
        prescriptionRequired: category.prescriptionRequired,
        depositRequired: category.depositRequired,
        installationRequired: category.installationRequired,
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        categoryName: "",
        prescriptionRequired: false,
        depositRequired: false,
        installationRequired: false,
        isActive: true,
      });
    }
    setCategoryDialogOpen(true);
  };

  const saveCategory = async () => {
    try {
      setLoading(true);
      if (editingCategory) {
        await adminApi.updateProductCategory(editingCategory.id, {
          ...categoryForm,
          id: editingCategory.id,
        });
        toast.success("Category updated");
      } else {
        await adminApi.createProductCategory(categoryForm);
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
    if (!confirm("Are you sure you want to delete this category? This will also delete all products in this category.")) return;
    
    try {
      setLoading(true);
      await adminApi.deleteProductCategory(id);
      toast.success("Category deleted");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete category.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const openProductDialog = (product?: ProductDto) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        categoryId: product.categoryId,
        productName: product.productName,
        brandName: product.brandName,
        modelName: product.modelName,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        isActive: product.isActive,
      });
    } else {
      setEditingProduct(null);
      setProductForm({
        categoryId: categories[0]?.id || "",
        productName: "",
        brandName: "",
        modelName: "",
        shortDescription: "",
        longDescription: "",
        isActive: true,
      });
    }
    setProductDialogOpen(true);
  };

  const saveProduct = async () => {
    try {
      setLoading(true);
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, {
          ...productForm,
          id: editingProduct.id,
        });
        toast.success("Product updated");
      } else {
        await adminApi.createProduct(productForm);
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
    if (!confirm("Are you sure you want to delete this product?")) return;
    
    try {
      setLoading(true);
      await adminApi.deleteProduct(id);
      toast.success("Product deleted");
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete product.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const result = await adminApi.uploadCatalogExcel(file);
      
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
      // Create workbook with two sheets
      const wb = XLSX.utils.book_new();

      // Categories sheet - headers only
      const categoriesHeaders = [
        ["category_name", "prescription_required", "deposit_required", "installation_required", "is_active"]
      ];
      const categoriesWs = XLSX.utils.aoa_to_sheet(categoriesHeaders);
      XLSX.utils.book_append_sheet(wb, categoriesWs, "Categories");

      // Products sheet - headers only
      const productsHeaders = [
        ["category_name", "product_name", "brand_name", "model_name", "short_description", "long_description", "is_active"]
      ];
      const productsWs = XLSX.utils.aoa_to_sheet(productsHeaders);
      XLSX.utils.book_append_sheet(wb, productsWs, "Products");

      // Download file
      XLSX.writeFile(wb, "catalog_template.xlsx");
      toast.success("Sample template downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download template.";
      toast.error(message);
    }
  };

  const downloadExistingData = async () => {
    try {
      setLoading(true);
      await adminApi.downloadCatalogExcel();
      toast.success("Catalog data downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download catalog data.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products Management"
        description="Manage product categories and products for the marketplace catalog."
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
            <Button onClick={() => setExcelDialogOpen(true)} disabled={loading} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Upload Excel</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loading && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="categories" className="text-xs sm:text-sm">
              <FolderTree className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Categories</span>
              <span className="hidden sm:inline ml-1">({categories.length})</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs sm:text-sm">
              <Package className="mr-1 sm:mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Products</span>
              <span className="hidden sm:inline ml-1">({products.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
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
                <span className="hidden sm:inline">New {activeTab === "categories" ? "Category" : "Product"}</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>

          <TabsContent value="categories" className="mt-4">
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
                  {filteredCategories.map((c) => (
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
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <div className="overflow-x-auto rounded-lg border border-border -mx-4 sm:mx-0">
              <table className="w-full min-w-[700px] sm:min-w-[800px] text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product Name</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Brand</th>
                    <th className="px-4 py-3 font-semibold">Model</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{p.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getCategoryName(p.categoryId)}</td>
                      <td className="px-4 py-3">{p.brandName || "-"}</td>
                      <td className="px-4 py-3">{p.modelName || "-"}</td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={p.isActive}
                          onCheckedChange={() => toggleProductStatus(p.id, p.isActive)}
                          disabled={loading}
                        />
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
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={1}>
              <div className="space-y-1.5">
                <Label>Category Name</Label>
                <Input
                  value={categoryForm.categoryName}
                  onChange={(e) => setCategoryForm({ ...categoryForm, categoryName: e.target.value })}
                  placeholder="E.g. Home Appliances"
                />
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
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={2}>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={productForm.categoryId}
                  onValueChange={(v) => setProductForm({ ...productForm, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product Name</Label>
                <Input
                  value={productForm.productName}
                  onChange={(e) => setProductForm({ ...productForm, productName: e.target.value })}
                  placeholder="E.g. Washing Machine"
                />
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
                  placeholder="Brief product description"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Long Description</Label>
                <Input
                  value={productForm.longDescription || ""}
                  onChange={(e) => setProductForm({ ...productForm, longDescription: e.target.value })}
                  placeholder="Detailed product description"
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="productActive"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                />
                <Label htmlFor="productActive">Active</Label>
              </div>
            </FormGrid>
            <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={saveProduct} disabled={loading}>
              {editingProduct ? "Update" : "Create"} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Excel</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <p className="text-sm text-muted-foreground mb-4">
              Upload an Excel file with two sheets: "Categories" and "Products".<br />
              <strong>Need a template?</strong> Use the "Download Sample Excel" option above to get started.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="w-full"
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
