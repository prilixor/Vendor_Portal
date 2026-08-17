import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  adminApi,
  type CreateRentalDurationIconRequest,
  type RentalDurationIconDto,
  type RentalValueTier,
} from "@/app/services/adminApi";
import { ImagePlus, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { cn, retryOriginalOnImageError } from "@/app/helpers/utils";
import {
  RENTAL_VALUE_TIERS,
  rentalValueTierLabel,
  resolveRentalIconUrl,
} from "@/app/helpers/rentalDurationIcons";

type FormState = {
  name: string;
  valueTier: RentalValueTier;
  /** Durable storage key (S3 / uploads path) — what we persist. */
  imageUrl: string;
  thumbnailUrl: string;
  /** Browser-ready preview (presigned or absolute). */
  previewUrl: string;
  previewThumbnailUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  valueTier: "good",
  imageUrl: "",
  thumbnailUrl: "",
  previewUrl: "",
  previewThumbnailUrl: "",
  sortOrder: 0,
  isActive: true,
});

/** Prefer storage key for DB; fall back to fileUrl only when storageKey is absent (local disk). */
const pickStoredRef = (storageKey?: string | null, fileUrl?: string | null) =>
  (storageKey?.trim() || fileUrl?.trim() || "").trim();

const pickPreviewUrl = (fileUrl?: string | null, storageKey?: string | null) =>
  (fileUrl?.trim() || storageKey?.trim() || "").trim();

const tierBadgeClass = (tier?: string | null): string => {
  const key = (tier ?? "").toLowerCase().replace(/-/g, "_");
  switch (key) {
    case "good":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "better":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "best_value":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
    case "maximum_savings":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "";
  }
};

type AdminRentalDurationIconsProps = {
  /** When true, omit PageHeader (used inside Rental Setup tabs). */
  embedded?: boolean;
};

const AdminRentalDurationIcons = ({ embedded = false }: AdminRentalDurationIconsProps) => {
  const [rows, setRows] = useState<RentalDurationIconDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RentalDurationIconDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getRentalDurationIcons(false);
      setRows(data);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to load rental icons"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    return { total: rows.length, active, inactive: rows.length - active };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const matchesSearch =
          !q ||
          r.name.toLowerCase().includes(q) ||
          rentalValueTierLabel(r.valueTier).toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all" || (statusFilter === "active" ? r.isActive : !r.isActive);
        return matchesSearch && matchesStatus;
      })
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [rows, search, statusFilter]);

  const deleteTarget = useMemo(
    () => rows.find((r) => r.id === deleteId) ?? null,
    [rows, deleteId],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      sortOrder: rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 1,
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row: RentalDurationIconDto) => {
    setEditing(row);
    const stored = (row.imageStorageKey?.trim() || row.imageUrl || "").trim();
    const storedThumb = (row.thumbnailStorageKey?.trim() || row.thumbnailUrl || "").trim();
    setForm({
      name: row.name,
      valueTier: (row.valueTier as RentalValueTier) || "good",
      imageUrl: stored,
      thumbnailUrl: storedThumb,
      previewUrl: row.imageUrl || stored,
      previewThumbnailUrl: row.thumbnailUrl || storedThumb,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Enter an icon name.";
    if (!form.imageUrl.trim()) errors.imageUrl = "Upload an icon image.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await adminApi.uploadRentalIconFile(file);
      const imageUrl = pickStoredRef(uploaded.storageKey, uploaded.fileUrl);
      const thumbnailUrl = pickStoredRef(uploaded.thumbnailStorageKey, uploaded.thumbnailUrl);
      if (!imageUrl) throw new Error("Upload did not return a file URL.");
      setForm((prev) => ({
        ...prev,
        imageUrl,
        thumbnailUrl,
        previewUrl: pickPreviewUrl(uploaded.fileUrl, uploaded.storageKey),
        previewThumbnailUrl: pickPreviewUrl(uploaded.thumbnailUrl, uploaded.thumbnailStorageKey),
      }));
      setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
      toast.success("Icon image uploaded");
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to upload icon"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!validate()) {
      toast.error("Please fill in the required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateRentalDurationIconRequest = {
        name: form.name.trim(),
        valueTier: form.valueTier,
        imageUrl: form.imageUrl.trim(),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (editing) {
        await adminApi.updateRentalDurationIcon(editing.id, { ...payload, id: editing.id });
        toast.success("Rental icon updated");
      } else {
        await adminApi.createRentalDurationIcon(payload);
        toast.success("Rental icon created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to save rental icon"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: RentalDurationIconDto) => {
    setTogglingId(row.id);
    try {
      const imageUrl = (row.imageStorageKey?.trim() || row.imageUrl || "").trim();
      const thumbnailUrl = (row.thumbnailStorageKey?.trim() || row.thumbnailUrl || "").trim() || null;
      await adminApi.updateRentalDurationIcon(row.id, {
        id: row.id,
        name: row.name,
        valueTier: row.valueTier,
        imageUrl,
        thumbnailUrl,
        sortOrder: row.sortOrder,
        isActive: !row.isActive,
      });
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
      );
      toast.success(!row.isActive ? "Icon activated" : "Icon deactivated");
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await adminApi.deleteRentalDurationIcon(deleteId);
      toast.success("Rental icon deleted");
      setDeleteId(null);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to delete rental icon"));
    } finally {
      setSaving(false);
    }
  };

  const renderIconThumb = (
    row: Pick<RentalDurationIconDto, "name" | "imageUrl" | "thumbnailUrl">,
    size = "md",
  ) => {
    const box = size === "lg" ? "h-14 w-14" : "h-11 w-11";
    // API already resolves to browser URL (presigned S3); resolveRentalIconUrl handles legacy local paths.
    const src = resolveRentalIconUrl(row.thumbnailUrl || row.imageUrl);
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30",
          box,
        )}
      >
        {src ? (
          <img src={src} alt={row.name} className="h-full w-full object-contain p-1.5" onError={retryOriginalOnImageError} />
        ) : (
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Rental Duration Icons"
          description="Upload icons and map them to Good / Better / Best Value / Maximum Savings. Assign per product in the Duration price chart."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total icons</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.total}</p>
        </Card>
        <Card className="border-border/70 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {stats.active}
          </p>
        </Card>
        <Card className="border-border/70 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inactive</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">{stats.inactive}</p>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or value tier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add icon
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <ImagePlus className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No rental icons found</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {rows.length === 0
                  ? "Add tier icons (ribbon, star, crown, trophy) to use on product duration charts."
                  : "Try a different search or status filter."}
              </p>
            </div>
            {rows.length === 0 && (
              <Button onClick={openCreate} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add first icon
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Icon</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Value tier</th>
                    <th className="px-4 py-3 font-semibold text-right">Sort order</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/70 last:border-0 transition-colors hover:bg-muted/30",
                        !row.isActive && "bg-muted/10",
                      )}
                    >
                      <td className="px-5 py-3.5">{renderIconThumb(row)}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-foreground">{row.name}</p>
                        <p className="text-xs text-muted-foreground">Shown on product duration charts</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className={cn("font-medium", tierBadgeClass(row.valueTier))}
                        >
                          {rentalValueTierLabel(row.valueTier)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
                          {row.sortOrder}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={row.isActive}
                            disabled={togglingId === row.id || saving}
                            onCheckedChange={() => void toggleActive(row)}
                            aria-label={`Toggle ${row.name}`}
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              row.isActive
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.isActive ? "Active" : "Off"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(row.id)}
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {filtered.map((row) => (
                <div key={row.id} className={cn("space-y-3 p-4", !row.isActive && "opacity-70")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {renderIconThumb(row, "lg")}
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{row.name}</p>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", tierBadgeClass(row.valueTier))}
                        >
                          {rentalValueTierLabel(row.valueTier)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Sort</span>
                      <span className="rounded-md border border-border/70 bg-background px-1.5 py-0.5 font-mono tabular-nums text-foreground">
                        {row.sortOrder}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Active</span>
                      <Switch
                        checked={row.isActive}
                        disabled={togglingId === row.id || saving}
                        onCheckedChange={() => void toggleActive(row)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="space-y-1 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{editing ? "Edit rental icon" : "Add rental icon"}</DialogTitle>
            <DialogDescription>
              Customers see this icon on the product rental chart when it is assigned to a duration row.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 sm:px-6">
            <FormGrid>
              <div className="space-y-1.5 sm:col-span-2">
                <Label required>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Blue Star"
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-1.5">
                <Label required>Value tier</Label>
                <Select
                  value={form.valueTier}
                  onValueChange={(v) => setForm({ ...form, valueTier: v as RentalValueTier })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENTAL_VALUE_TIERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label required>Icon image</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/15 p-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background">
                    {form.previewUrl || form.imageUrl ? (
                      <img
                        src={resolveRentalIconUrl(
                          form.previewThumbnailUrl || form.previewUrl || form.thumbnailUrl || form.imageUrl,
                        )}
                        alt=""
                        className="h-full w-full object-contain p-1.5"
                        onError={retryOriginalOnImageError}
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload image
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG or JPG, square works best.</p>
                    <FieldError message={fieldErrors.imageUrl} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
                <Label>Active</Label>
              </div>
            </FormGrid>
          </div>
          <DialogFooter className="border-t border-border bg-muted/10 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || uploading} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete icon?</DialogTitle>
            <DialogDescription>
              Soft-delete {deleteTarget?.name ?? "this icon"}. Products already using it keep their saved snapshot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRentalDurationIcons;
