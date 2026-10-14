import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { StateCityFields } from "@/app/components/shared/StateCityFields";
import { SearchableMultiSelect } from "@/app/components/shared/SearchableMultiSelect";
import {
  adminApi,
  AdminHospitalDto,
  CreateAdminHospitalRequest,
  UpdateAdminHospitalRequest,
} from "@/app/services/adminApi";
import { missingAddressFieldLabels } from "@/app/helpers/reverseGeocode";
import { cn } from "@/app/helpers/utils";
import { Building2, Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type HospitalForm = {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  contactNumber: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  doctorIds: string[];
};

const emptyForm = (): HospitalForm => ({
  name: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  contactNumber: "",
  latitude: 23.0225,
  longitude: 72.5714,
  isActive: true,
  doctorIds: [],
});

const PAGE_SIZE = 8;

const AdminHospitals = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminHospitalDto | null>(null);
  const [form, setForm] = useState<HospitalForm>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const applySearch = () => {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const { data, isLoading, isPlaceholderData, isError, error } = useQuery({
    queryKey: ["admin-hospital-summaries", page, appliedSearch, statusFilter],
    queryFn: () =>
      adminApi.getHospitalSummaries({
        search: appliedSearch,
        isActive: statusFilter === "all" ? undefined : statusFilter === "active",
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const isPageChanging = isPlaceholderData && !isLoading;

  const { data: doctorLookups = [] } = useQuery({
    queryKey: ["admin-doctor-options"],
    queryFn: () => adminApi.getDoctorOptions({ isActive: true }),
  });

  const hospitals = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, appliedSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (isError) {
      toast.error(getUserFriendlyMessage(error, "Failed to load hospitals"));
    }
  }, [isError, error]);

  const load = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-hospital-summaries"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-doctor-options"] }),
    ]);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (h: AdminHospitalDto) => {
    setEditing(h);
    setForm({
      name: h.name,
      addressLine1: h.addressLine1 || "",
      city: h.city || "",
      state: h.state || "",
      postalCode: h.postalCode || "",
      contactNumber: h.contactNumber || "",
      latitude: h.latitude ?? 23.0225,
      longitude: h.longitude ?? 72.5714,
      isActive: h.isActive,
      doctorIds: h.doctorIds || [],
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const doctorOptions = useMemo(() => {
    const fromLookup = doctorLookups.map((d) => ({
      id: d.id,
      label: d.label,
      badge: d.badge || undefined,
      secondary: d.secondary || undefined,
      searchText: [d.label, d.badge, d.secondary].filter(Boolean).join(" "),
    }));
    const extras = (editing?.doctorIds ?? [])
      .map((id, index) => ({
        id,
        label: editing?.doctorNames?.[index] || id,
        searchText: editing?.doctorNames?.[index] || id,
      }))
      .filter((d) => !fromLookup.some((o) => o.id === d.id));
    return [...extras, ...fromLookup];
  }, [doctorLookups, editing]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Hospital name is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateAdminHospitalRequest = {
          id: editing.id,
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          contactNumber: form.contactNumber.trim() || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
          isActive: form.isActive,
          doctorIds: form.doctorIds,
        };
        await adminApi.updateHospital(editing.id, payload);
        toast.success("Hospital updated");
      } else {
        const payload: CreateAdminHospitalRequest = {
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          contactNumber: form.contactNumber.trim() || undefined,
          latitude: form.latitude,
          longitude: form.longitude,
          doctorIds: form.doctorIds,
        };
        await adminApi.createHospital(payload);
        toast.success("Hospital created");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to save hospital"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (h: AdminHospitalDto) => {
    if (!confirm(`Remove hospital “${h.name}”? Linked doctor associations will be cleared.`)) return;
    try {
      await adminApi.deleteHospital(h.id);
      toast.success("Hospital removed");
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to remove hospital"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hospitals"
        description="Admin-managed hospitals with address and map location. Link many doctors to each hospital."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Hospital
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, city, or address…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={applySearch}>
            Search
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <PageContentGate loading={isLoading}>{totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-40" />
            <p>No hospitals yet. Add one with address and map pin.</p>
          </div>
        ) : (
          <div className={cn("transition-opacity duration-200", isPageChanging && "opacity-50")}>
            <div className="divide-y">
            {hospitals.map((h) => {
              const address =
                [h.addressLine1, h.city, h.state, h.postalCode].filter(Boolean).join(", ") || "No address";
              return (
              <div key={h.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{h.name}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        h.isActive
                          ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
                          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
                      )}
                    >
                      {h.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {h.contactNumber ? (
                    <p className="truncate text-sm font-medium text-violet-600 dark:text-violet-400">
                      {h.contactNumber}
                    </p>
                  ) : null}
                  <p className="flex min-w-0 items-start gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="min-w-0 break-words">{address}</span>
                  </p>
                  {h.doctorNames && h.doctorNames.length > 0 && (
                    <p className="break-words text-xs text-muted-foreground">
                      {h.doctorNames.length} {h.doctorNames.length === 1 ? "doctor" : "doctors"} · {h.doctorNames.join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex w-full shrink-0 flex-nowrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Button size="sm" variant="outline" className="min-w-[6.25rem] flex-1 sm:flex-none" onClick={() => openEdit(h)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="min-w-[6.25rem] flex-1 sm:flex-none" onClick={() => void remove(h)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
              );
            })}
            </div>
            <div className="px-4 pb-4 sm:px-6">
              <TablePagination
                page={safePage}
                pageSize={PAGE_SIZE}
                total={totalCount}
                onPageChange={setPage}
                label="hospitals"
              />
            </div>
          </div>
        )}</PageContentGate>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Hospital" : "Add Hospital"}</DialogTitle>
          </DialogHeader>
          <FormGrid>
            <div className="space-y-2 sm:col-span-2">
              <Label required>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <FieldError message={fieldErrors.name} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <StateCityFields
                state={form.state}
                city={form.city}
                onStateChange={(state) => setForm((f) => ({ ...f, state }))}
                onCityChange={(city) => setForm((f) => ({ ...f, city }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Postal code</Label>
              <Input value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contact number</Label>
              <Input
                value={form.contactNumber}
                onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Map location</Label>
              <MapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
                onAddressResolved={(address) => {
                  const nextLine1 = address?.line1 || form.addressLine1;
                  const nextCity = address?.city || form.city;
                  const nextState = address?.state || form.state;
                  const nextPostal = address?.postal || form.postalCode;

                  if (address && (address.line1 || address.state || address.city || address.postal)) {
                    setForm((f) => ({
                      ...f,
                      ...(address.line1 ? { addressLine1: address.line1 } : {}),
                      ...(address.state ? { state: address.state } : {}),
                      ...(address.city ? { city: address.city } : {}),
                      ...(address.postal ? { postalCode: address.postal } : {}),
                    }));
                  }

                  const missing = missingAddressFieldLabels({
                    line1: nextLine1,
                    city: nextCity,
                    state: nextState,
                    postal: nextPostal,
                  });
                  if (missing.length === 0) {
                    toast.success("Location applied from map.");
                  } else {
                    toast.message(`Map pin saved. Please fill required ${missing.join(", ")}.`);
                  }
                }}
                height="h-56"
              />
            </div>
            <div className="sm:col-span-2">
              <SearchableMultiSelect
                label="Linked doctors"
                options={doctorOptions}
                selectedIds={form.doctorIds}
                onChange={(doctorIds) => setForm((f) => ({ ...f, doctorIds }))}
                placeholder="Select doctors…"
                searchPlaceholder="Search by name, Unique ID, or specialization…"
                emptyMessage="No active doctors yet."
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between sm:col-span-2">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              </div>
            )}
          </FormGrid>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create hospital"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminHospitals;
