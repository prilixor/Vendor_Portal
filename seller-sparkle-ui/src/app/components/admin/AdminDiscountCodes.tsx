import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { cn } from "@/app/helpers/utils";
import {
  adminApi,
  DiscountCodeDto,
  ProductCategoryDto,
  ProductDto,
  SaveDiscountCodeRequest,
} from "@/app/services/adminApi";
import { FlaskConical, Package, Pencil, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

type FormState = {
  id?: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  maxDiscountAmount: string;
  minimumItemTotal: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  maxTotalUses: string;
  maxUsesPerCustomer: string;
  appliesTo: "rent" | "buy" | "both";
  showToCustomers: boolean;
  productIds: string[];
  categoryIds: string[];
};

const emptyForm = (): FormState => ({
  code: "",
  discountType: "percentage",
  discountValue: "",
  maxDiscountAmount: "",
  minimumItemTotal: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
  maxTotalUses: "",
  maxUsesPerCustomer: "",
  appliesTo: "both",
  showToCustomers: false,
  productIds: [],
  categoryIds: [],
});

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function describeCode(row: DiscountCodeDto) {
  if (row.discountType === "fixed") return `₹${Number(row.discountValue).toLocaleString("en-IN")} off the item price`;
  const cap = row.maxDiscountAmount ? `, up to ₹${Number(row.maxDiscountAmount).toLocaleString("en-IN")}` : "";
  return `${Number(row.discountValue)}% off the item price${cap}`;
}

type CodeStatus = "off" | "scheduled" | "expired" | "used-up" | "active";

function codeStatus(row: Pick<DiscountCodeDto, "isActive" | "startsAt" | "endsAt" | "maxTotalUses" | "usedCount">, now = Date.now()): CodeStatus {
  if (!row.isActive) return "off";
  const ends = row.endsAt ? new Date(row.endsAt).getTime() : Number.NaN;
  if (!Number.isNaN(ends) && now > ends) return "expired";
  const starts = row.startsAt ? new Date(row.startsAt).getTime() : Number.NaN;
  if (!Number.isNaN(starts) && now < starts) return "scheduled";
  if (row.maxTotalUses != null && row.usedCount >= row.maxTotalUses) return "used-up";
  return "active";
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function windowNote(startsAt: string, endsAt: string) {
  const now = Date.now();
  const ends = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  if (!Number.isNaN(ends) && now > ends) {
    return "The end time has passed, so customers cannot use this code. Set a later end time, or turn Active off.";
  }
  const starts = startsAt ? new Date(startsAt).getTime() : Number.NaN;
  if (!Number.isNaN(starts) && now < starts) {
    return "This code is scheduled. Customers cannot use it until the start time.";
  }
  return null;
}

function StatusBadge({ status }: { status: CodeStatus }) {
  if (status === "active") return <Badge>Active</Badge>;
  if (status === "off") return <Badge variant="secondary">Off</Badge>;
  if (status === "scheduled") {
    return <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">Scheduled</Badge>;
  }
  if (status === "used-up") {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Used up</Badge>;
  }
  return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Expired</Badge>;
}

function catalogKind(isChemical?: boolean) {
  return isChemical ? "Chemical" : "Equipment";
}

function CatalogKindBadge({ isChemical }: { isChemical?: boolean }) {
  if (isChemical) {
    return <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-800">Chemical</Badge>;
  }
  return <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] text-teal-800">Equipment</Badge>;
}

function CategoryPanel({
  title,
  tone,
  categories,
  selectedIds,
  onToggle,
  onSetAll,
}: {
  title: string;
  tone: "equipment" | "chemical";
  categories: ProductCategoryDto[];
  selectedIds: string[];
  onToggle: (category: ProductCategoryDto) => void;
  onSetAll: (ids: string[], selected: boolean) => void;
}) {
  const [filter, setFilter] = useState("");
  const selected = categories.filter((category) => selectedIds.includes(category.id)).length;
  const allChecked = categories.length > 0 && selected === categories.length;
  const someChecked = selected > 0 && !allChecked;
  const query = filter.trim().toLowerCase();
  const visible = query
    ? categories.filter((category) => category.categoryName.toLowerCase().includes(query))
    : categories;
  const chemical = tone === "chemical";
  const selectionLabel = allChecked ? "All selected" : selected === 0 ? "None selected" : `${selected} selected`;

  return (
    <div className={cn("rounded-lg border", chemical ? "border-violet-200" : "border-teal-200")}>
      <div className={cn("flex items-center justify-between gap-2 border-b px-3 py-2", chemical ? "border-violet-200 bg-violet-50" : "border-teal-200 bg-teal-50")}>
        <span className={cn("flex items-center gap-1.5 text-sm font-semibold", chemical ? "text-violet-900" : "text-teal-900")}>
          {chemical ? <FlaskConical className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground">{selectionLabel}</span>
      </div>
      {categories.length > 6 ? (
        <div className="border-b px-2 py-2">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={`Find ${title.toLowerCase()}`}
            className="h-8"
          />
        </div>
      ) : null}
      {categories.length > 0 ? (
        <label className={cn("flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 text-sm font-medium hover:bg-muted", allChecked && "bg-muted")}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={(node) => {
              if (node) node.indeterminate = someChecked;
            }}
            onChange={() => onSetAll(categories.map((category) => category.id), !allChecked)}
          />
          <span>All</span>
        </label>
      ) : null}
      <div className="max-h-44 overflow-y-auto p-1">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">{categories.length === 0 ? "None" : "No match"}</p>
        ) : visible.map((category) => {
          const checked = selectedIds.includes(category.id);
          return (
            <label
              key={category.id}
              className={cn("flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted", checked && "bg-muted")}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(category)} />
              <span className="min-w-0">{category.categoryName}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const AdminDiscountCodes = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [productQuery, setProductQuery] = useState("");
  const [productCatalog, setProductCatalog] = useState<"all" | "equipment" | "chemical">("all");
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  const codesQuery = useQuery({
    queryKey: ["admin-discount-codes"],
    queryFn: () => adminApi.getDiscountCodes(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-product-categories"],
    queryFn: () => adminApi.getProductCategories(),
  });
  const productSearch = useQuery({
    queryKey: ["admin-discount-product-search", productQuery, productCatalog],
    queryFn: () => adminApi.getProductSummaries({
      search: productQuery,
      page: 1,
      pageSize: 8,
      isChemical: productCatalog === "all" ? undefined : productCatalog === "chemical",
    }),
    enabled: open && productQuery.trim().length >= 2,
  });
  const selectedProducts = useQuery({
    queryKey: ["admin-discount-selected-products", form.productIds],
    queryFn: () => adminApi.getProductSummaries({
      ids: form.productIds,
      page: 1,
      pageSize: Math.max(form.productIds.length, 1),
    }),
    enabled: open && form.productIds.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SaveDiscountCodeRequest) => adminApi.saveDiscountCode(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
      setOpen(false);
      toast.success("Discount code saved");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save the discount code."),
  });

  const categories = categoriesQuery.data ?? [];
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const equipmentCategories = categories.filter((category) => !category.isChemical);
  const chemicalCategories = categories.filter((category) => category.isChemical);
  const productById = useMemo(() => {
    const map = new Map<string, ProductDto>();
    for (const product of selectedProducts.data?.items ?? []) map.set(product.id, product);
    for (const product of productSearch.data?.items ?? []) map.set(product.id, product);
    return map;
  }, [productSearch.data?.items, selectedProducts.data?.items]);

  const openCreate = () => {
    setForm(emptyForm());
    setProductQuery("");
    setProductCatalog("all");
    setOpen(true);
  };

  const openEdit = (row: DiscountCodeDto) => {
    setForm({
      id: row.id,
      code: row.code,
      discountType: row.discountType === "fixed" ? "fixed" : "percentage",
      discountValue: String(row.discountValue),
      maxDiscountAmount: row.maxDiscountAmount ? String(row.maxDiscountAmount) : "",
      minimumItemTotal: row.minimumItemTotal != null ? String(row.minimumItemTotal) : "",
      startsAt: toLocalInput(row.startsAt),
      endsAt: toLocalInput(row.endsAt),
      isActive: row.isActive,
      maxTotalUses: row.maxTotalUses ? String(row.maxTotalUses) : "",
      maxUsesPerCustomer: row.maxUsesPerCustomer ? String(row.maxUsesPerCustomer) : "",
      appliesTo: row.appliesTo === "rent" || row.appliesTo === "buy" ? row.appliesTo : "both",
      showToCustomers: row.showToCustomers,
      productIds: row.productIds ?? [],
      categoryIds: row.categoryIds ?? [],
    });
    setProductQuery("");
    setProductCatalog("all");
    setOpen(true);
  };

  const scheduleNote = windowNote(form.startsAt, form.endsAt);

  const save = () => {
    const value = optionalNumber(form.discountValue);
    if (!form.code.trim() || value == null || value <= 0) {
      toast.error("Enter a code and a discount greater than zero.");
      return;
    }
    saveMutation.mutate({
      id: form.id,
      code: form.code.trim(),
      discountType: form.discountType,
      discountValue: value,
      maxDiscountAmount: form.discountType === "percentage" ? optionalNumber(form.maxDiscountAmount) : null,
      minimumItemTotal: optionalNumber(form.minimumItemTotal),
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt),
      isActive: form.isActive,
      maxTotalUses: optionalNumber(form.maxTotalUses),
      maxUsesPerCustomer: optionalNumber(form.maxUsesPerCustomer),
      appliesTo: form.appliesTo,
      showToCustomers: form.showToCustomers,
      productIds: form.productIds,
      categoryIds: form.categoryIds,
    });
  };

  const addProduct = (product: ProductDto) => {
    setProductNames((current) => ({ ...current, [product.id]: product.productName }));
    setForm((current) =>
      current.productIds.includes(product.id)
        ? current
        : { ...current, productIds: [...current.productIds, product.id] },
    );
    setProductQuery("");
  };

  const toggleCategory = (category: ProductCategoryDto) => {
    setForm((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(category.id)
        ? current.categoryIds.filter((id) => id !== category.id)
        : [...current.categoryIds, category.id],
    }));
  };

  const setCategoryGroup = (ids: string[], selected: boolean) => {
    const group = new Set(ids);
    setForm((current) => ({
      ...current,
      categoryIds: selected
        ? [...new Set([...current.categoryIds, ...ids])]
        : current.categoryIds.filter((id) => !group.has(id)),
    }));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Discount codes"
        description="Codes reduce the customer's item price at checkout. The deposit, delivery fees, and vendor payout stay the same."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New code
          </Button>
        }
      />
      <PageContentGate loading={codesQuery.isLoading}>
        <Card className="divide-y">
          {(codesQuery.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <Ticket className="h-6 w-6" />
              No discount codes yet.
            </div>
          ) : (
            (codesQuery.data ?? []).map((row) => {
              const status = codeStatus(row);
              const timing = status === "expired"
                ? ` · ended ${formatWhen(row.endsAt)}`
                : status === "scheduled"
                  ? ` · starts ${formatWhen(row.startsAt)}`
                  : "";
              return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-wide">{row.code}</p>
                    <StatusBadge status={status} />
                    {status === "active" ? (
                      row.showToCustomers
                        ? <Badge variant="outline">Shown at checkout</Badge>
                        : <Badge variant="outline">Private</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {describeCode(row)} · {row.appliesTo} · used {row.usedCount}
                    {row.maxTotalUses ? ` of ${row.maxTotalUses}` : ""}
                    {timing}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
              );
            })
          )}
        </Card>
      </PageContentGate>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit discount code" : "New discount code"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="WELCOME10" />
            </div>
            <div className="space-y-1.5">
              <Label>Applies to</Label>
              <Select value={form.appliesTo} onValueChange={(value: FormState["appliesTo"]) => setForm({ ...form, appliesTo: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Rent and buy</SelectItem>
                  <SelectItem value="rent">Rent only</SelectItem>
                  <SelectItem value="buy">Buy only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select value={form.discountType} onValueChange={(value: FormState["discountType"]) => setForm({ ...form, discountType: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percent</SelectItem>
                  <SelectItem value="fixed">Fixed amount (INR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.discountType === "fixed" ? "Amount (INR)" : "Percent"}</Label>
              <Input type="number" min={0} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} />
            </div>
            {form.discountType === "percentage" ? (
              <div className="space-y-1.5">
                <Label>Maximum off (INR, optional)</Label>
                <Input type="number" min={0} value={form.maxDiscountAmount} onChange={(event) => setForm({ ...form, maxDiscountAmount: event.target.value })} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Minimum item total (INR, optional)</Label>
              <Input type="number" min={0} value={form.minimumItemTotal} onChange={(event) => setForm({ ...form, minimumItemTotal: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Total uses (optional)</Label>
              <Input type="number" min={1} value={form.maxTotalUses} onChange={(event) => setForm({ ...form, maxTotalUses: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Uses per customer (optional)</Label>
              <Input type="number" min={1} value={form.maxUsesPerCustomer} onChange={(event) => setForm({ ...form, maxUsesPerCustomer: event.target.value })} />
            </div>
            {scheduleNote ? (
              <p className="sm:col-span-2 text-xs text-amber-800">{scheduleNote}</p>
            ) : null}
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              Active
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              Show to customers
              <Switch checked={form.showToCustomers} onCheckedChange={(checked) => setForm({ ...form, showToCustomers: checked })} />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <Label>Categories</Label>
              <p className="text-xs text-muted-foreground">Check categories in either catalog. A checked category covers every product in it. Leave both empty to allow every eligible item.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CategoryPanel title="Equipment" tone="equipment" categories={equipmentCategories} selectedIds={form.categoryIds} onToggle={toggleCategory} onSetAll={setCategoryGroup} />
                <CategoryPanel title="Chemicals" tone="chemical" categories={chemicalCategories} selectedIds={form.categoryIds} onToggle={toggleCategory} onSetAll={setCategoryGroup} />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Products</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                <Input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Search products to limit this code" />
                <Select value={productCatalog} onValueChange={(value) => {
                  if (value === "equipment" || value === "chemical" || value === "all") setProductCatalog(value);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Equipment and chemical</SelectItem>
                    <SelectItem value="equipment">Equipment only</SelectItem>
                    <SelectItem value="chemical">Chemical only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(productSearch.data?.items ?? []).length > 0 ? (
                <div className="rounded-lg border">
                  {(productSearch.data?.items ?? []).map((product) => {
                    const category = categoryById.get(product.categoryId);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => addProduct(product)}
                      >
                        <span>
                          <span className="block">{product.productName}</span>
                          <span className="block text-xs text-muted-foreground">{category?.categoryName ?? "Category"}</span>
                        </span>
                        <CatalogKindBadge isChemical={category?.isChemical} />
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {form.productIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.productIds.map((id) => {
                    const product = productById.get(id);
                    const category = product ? categoryById.get(product.categoryId) : undefined;
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {product?.productName ?? productNames[id] ?? id.slice(0, 8)}
                        {category ? ` · ${catalogKind(category.isChemical)}` : ""}
                        <button type="button" onClick={() => setForm({ ...form, productIds: form.productIds.filter((item) => item !== id) })}>×</button>
                      </Badge>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : "Save code"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscountCodes;
