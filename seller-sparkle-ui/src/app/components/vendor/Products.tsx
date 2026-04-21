import { useRef, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { mockProducts } from "@/app/services/mockData";
import { ProductListing } from "@/app/models";
import { Plus, Search, Pencil, Image as ImageIcon, Star, Upload, Trash2, X, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { toast } from "sonner";

const categories = ["Power Tools", "Camping", "Photography", "Cleaning Equipment", "Event Equipment", "Audio Visual"];
const catalogProducts = ["Bosch GSB 550 Drill", "Quechua Arpenaz 4-Person Tent", "Sony A7 III Body", "Karcher Pressure Washer", "JBL PA Speaker", "Manfrotto Tripod", "DJI Ronin Gimbal"];

const blank: ProductListing = {
  id: "", category: "Power Tools", productName: "", title: "", dailyRent: 0, monthlyRent: 0,
  securityDeposit: 0, quantity: 1, status: "draft", images: [], createdAt: new Date().toISOString(),
};

const Products = () => {
  const [products, setProducts] = useState<ProductListing[]>(mockProducts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");
  const [editing, setEditing] = useState<ProductListing | null>(null);
  const [mediaFor, setMediaFor] = useState<ProductListing | null>(null);
  const [tempImages, setTempImages] = useState<MediaImage[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = products.filter((p) => {
    const m = (filter === "all" || p.status === filter);
    const s = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    return m && s;
  });

  const openNew = () => setEditing({ ...blank, id: `p${Date.now()}` });
  const save = () => {
    if (!editing) return;
    if (!editing.title || !editing.productName) { toast.error("Title and product are required"); return; }
    setProducts((prev) => prev.some((p) => p.id === editing.id) ? prev.map((p) => p.id === editing.id ? editing : p) : [...prev, editing]);
    setEditing(null);
    toast.success("Listing saved");
  };

  const openMedia = (p: ProductListing) => {
    setMediaFor(p);
    const sourceImages = p.images.length ? p.images : p.primaryImage ? [p.primaryImage] : [];
    setTempImages(
      sourceImages.map((url, i) => ({
        id: `img-${i}-${Date.now()}`,
        primary: i === 0,
        url,
      }))
    );
  };

  const setPrimary = (id: string) => setTempImages((imgs) => imgs.map((i) => ({ ...i, primary: i.id === id })));
  const removeImg = (id: string) => setTempImages((imgs) => imgs.filter((i) => i.id !== id));
  const addImg = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const uploaded = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: `img-${Date.now()}-${file.name}`,
        primary: false,
        url: await fileToDataUrl(file),
      }))
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
  };
  const reorder = (from: number, to: number) => setTempImages((imgs) => { const c = [...imgs]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  const previewImage = (url: string) => setPreviewUrl(url);
  const saveMedia = () => {
    if (!mediaFor) return;
    const sorted = [...tempImages];
    const primary = sorted.find((img) => img.primary) ?? sorted[0];
    const updatedImages = sorted.map((img) => img.url);
    setProducts((prev) =>
      prev.map((product) =>
        product.id === mediaFor.id
          ? {
              ...product,
              images: updatedImages,
              primaryImage: primary?.url,
            }
          : product
      )
    );
    setMediaFor(null);
    toast.success("Media updated");
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your rental catalog. Add new listings, set pricing, and control availability."
        actions={
          <Button onClick={openNew} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" /> New listing
          </Button>
        }
      />

      <Card className="border-border/60">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings…" className="pl-9" />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All <span className="ml-1.5 text-xs text-muted-foreground">({products.length})</span></TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3"><StatusBadge status={p.status === "active" ? "approved" : "pending"} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openMedia(p)} aria-label="Media">
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product (from catalog)</Label>
                <Select value={editing.productName} onValueChange={(v) => setEditing({ ...editing, productName: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent>{catalogProducts.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Listing title</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="E.g. Sony A7 III — Daily Rental" />
              </div>
              <div className="space-y-1.5">
                <Label>Daily rent (₹)</Label>
                <Input type="number" value={editing.dailyRent} onChange={(e) => setEditing({ ...editing, dailyRent: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly rent (₹)</Label>
                <Input type="number" value={editing.monthlyRent} onChange={(e) => setEditing({ ...editing, monthlyRent: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Security deposit (₹)</Label>
                <Input type="number" value={editing.securityDeposit} onChange={(e) => setEditing({ ...editing, securityDeposit: +e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: +e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media dialog */}
      <Dialog open={!!mediaFor} onOpenChange={(v) => !v && setMediaFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media — {mediaFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => previewImage(img.url)} className="rounded-md bg-background/90 p-1 text-foreground hover:bg-background" aria-label="Preview">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {!img.primary && (
                      <button onClick={() => setPrimary(img.id)} className="rounded-md bg-background/90 p-1 text-foreground hover:bg-background" aria-label="Set primary">
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => removeImg(img.id)} className="rounded-md bg-background/90 p-1 text-destructive hover:bg-background" aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {tempImages.length === 0 && (
                <div className="col-span-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-4">
                  No images uploaded yet.
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Drag to reorder. The primary image appears first in your listing.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMediaFor(null)}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <Button onClick={saveMedia}>Save changes</Button>
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
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });


