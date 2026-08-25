import { useEffect, useMemo, useState } from "react";
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
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  adminApi,
  type CreateRentalDurationMasterRequest,
  type RentalDurationMasterDto,
} from "@/app/services/adminApi";
import { CalendarRange, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { cn } from "@/app/helpers/utils";

type FormState = {
  durationLabel: string;
  durationDays: number;
  billingCycles: number;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  durationLabel: "",
  durationDays: 28,
  billingCycles: 1,
  sortOrder: 0,
  isActive: true,
});

type AdminRentalDurationsProps = {
  /** When true, omit PageHeader (used inside Rental Setup tabs). */
  embedded?: boolean;
};

const AdminRentalDurations = ({ embedded = false }: AdminRentalDurationsProps) => {
  const [rows, setRows] = useState<RentalDurationMasterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RentalDurationMasterDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getRentalDurationMasters(false);
      setRows(data);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to load rental durations"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const matchesSearch =
          !q ||
          r.durationLabel.toLowerCase().includes(q) ||
          String(r.durationDays).includes(q);
        const matchesStatus =
          statusFilter === "all" || (statusFilter === "active" ? r.isActive : !r.isActive);
        return matchesSearch && matchesStatus;
      })
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.durationDays - b.durationDays);
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

  const openEdit = (row: RentalDurationMasterDto) => {
    setEditing(row);
    setForm({
      durationLabel: row.durationLabel,
      durationDays: row.durationDays,
      billingCycles: row.billingCycles && row.billingCycles > 0
        ? row.billingCycles
        : Math.round((row.durationDays / 28) * 100) / 100,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.durationLabel.trim()) errors.durationLabel = "Enter a billing-cycle label.";
    if (!(form.durationDays > 0)) errors.durationDays = "Duration days must be greater than 0.";
    if (!(form.billingCycles > 0)) errors.billingCycles = "Billing cycles must be greater than 0.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.error("Please fill in the required fields.");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateRentalDurationMasterRequest = {
        durationLabel: form.durationLabel.trim(),
        durationDays: form.durationDays,
        billingCycles: form.billingCycles,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (editing) {
        await adminApi.updateRentalDurationMaster(editing.id, { ...payload, id: editing.id });
        toast.success("Rental duration updated");
      } else {
        await adminApi.createRentalDurationMaster(payload);
        toast.success("Rental duration created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to save rental duration"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: RentalDurationMasterDto) => {
    setTogglingId(row.id);
    try {
      await adminApi.updateRentalDurationMaster(row.id, {
        id: row.id,
        durationLabel: row.durationLabel,
        durationDays: row.durationDays,
        billingCycles:
          row.billingCycles && row.billingCycles > 0
            ? row.billingCycles
            : Math.round((row.durationDays / 28) * 100) / 100,
        sortOrder: row.sortOrder,
        isActive: !row.isActive,
      });
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
      );
      toast.success(!row.isActive ? "Duration activated" : "Duration deactivated");
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await adminApi.deleteRentalDurationMaster(deleteId);
      toast.success("Rental duration removed");
      setDeleteId(null);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to delete rental duration"));
    } finally {
      setSaving(false);
    }
  };

  const recalculateCatalogPrices = async () => {
    setRecalculating(true);
    try {
      const result = await adminApi.recalculateAllRentalPricing(false);
      toast.success(`Updated automatic rental prices for ${result.productsProcessed} product(s). Manual Configure Prices overrides were kept.`);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to recalculate rental prices"));
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Billing Cycle Durations"
          description="Define billing-cycle names and day counts once. Product pricing uses these with a daily rate, discounts, and per-product icons."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/70 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total durations</p>
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
              placeholder="Search label or days…"
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
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void recalculateCatalogPrices()}
              disabled={loading || saving || recalculating}
            >
              {recalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Recalculate prices
            </Button>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add duration
            </Button>
          </div>
        </div>

        {loading ? (
          <PageLoaderSlot />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No rental durations found</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {rows.length === 0
                  ? "Add billing cycles like 0.5, 1, or 3 — then reuse them on every rent product."
                  : "Try a different search or status filter."}
              </p>
            </div>
            {rows.length === 0 && (
              <Button onClick={openCreate} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add first duration
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Billing cycle</th>
                    <th className="px-4 py-3 font-semibold text-right">Cycles</th>
                    <th className="px-4 py-3 font-semibold text-right">Days</th>
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                            <CalendarRange className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{row.durationLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              Shown on product duration charts
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">
                        {row.billingCycles && row.billingCycles > 0
                          ? row.billingCycles
                          : Math.round((row.durationDays / 28) * 100) / 100}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Badge variant="outline" className="font-mono font-normal tabular-nums">
                          {row.durationDays} days
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-muted-foreground">
                        {row.sortOrder}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={row.isActive}
                            disabled={togglingId === row.id || saving}
                            onCheckedChange={() => void toggleActive(row)}
                            aria-label={`Toggle ${row.durationLabel}`}
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
                            aria-label={`Edit ${row.durationLabel}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(row.id)}
                            aria-label={`Delete ${row.durationLabel}`}
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
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                        <CalendarRange className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.durationLabel}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {row.durationDays} days · sort {row.sortOrder}
                        </p>
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
                  <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Offer this duration</span>
                    <Switch
                      checked={row.isActive}
                      disabled={togglingId === row.id || saving}
                      onCheckedChange={() => void toggleActive(row)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>{editing ? "Edit billing cycle" : "Add billing cycle"}</DialogTitle>
            <DialogDescription>
              Use billing-cycle names for customers (e.g. 1 Billing Cycle). Days drive list price (= daily rate × days).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <FormGrid cols={2}>
              <div className="space-y-1.5 sm:col-span-2">
                <Label required>Label</Label>
                <Input
                  value={form.durationLabel}
                  onChange={(e) => setForm({ ...form, durationLabel: e.target.value })}
                  placeholder="e.g. 1 Billing Cycle"
                  className={fieldErrors.durationLabel ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.durationLabel} />
              </div>
              <div className="space-y-1.5">
                <Label required>Billing cycles</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.25}
                  value={form.billingCycles}
                  onChange={(e) => {
                    const billingCycles = Math.max(0.01, Number(e.target.value) || 0);
                    const durationDays = Math.max(1, Math.round(billingCycles * 28));
                    setForm({
                      ...form,
                      billingCycles,
                      durationDays,
                      durationLabel:
                        form.durationLabel.trim() === "" ||
                        /billing cycle/i.test(form.durationLabel)
                          ? billingCycles === 1
                            ? "1 Billing Cycle"
                            : `${billingCycles} Billing Cycles`
                          : form.durationLabel,
                    });
                  }}
                  className={fieldErrors.billingCycles ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.billingCycles} />
              </div>
              <div className="space-y-1.5">
                <Label required>Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(e) =>
                    setForm({ ...form, durationDays: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className={fieldErrors.durationDays ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.durationDays} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Available in product pricing charts</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>
            </FormGrid>
          </div>

          <DialogFooter className="border-t border-border bg-background px-5 py-3 sm:px-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Add duration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove rental duration?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.durationLabel}" (${deleteTarget.durationDays} days) will no longer appear when configuring new product prices. Existing product plans keep their snapshots.`
                : "This duration will no longer appear when configuring new product rental prices."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRentalDurations;
