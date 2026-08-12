import { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/app/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { StateCityFields } from "@/app/components/shared/StateCityFields";
import { SearchableMultiSelect } from "@/app/components/shared/SearchableMultiSelect";
import {
  adminApi,
  AdminHospitalDto,
  AdminDoctorDto,
  CreateAdminHospitalRequest,
  UpdateAdminHospitalRequest,
} from "@/app/services/adminApi";
import { missingAddressFieldLabels } from "@/app/helpers/reverseGeocode";
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

const AdminHospitals = () => {
  const [hospitals, setHospitals] = useState<AdminHospitalDto[]>([]);
  const [doctors, setDoctors] = useState<AdminDoctorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminHospitalDto | null>(null);
  const [form, setForm] = useState<HospitalForm>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const isActive = statusFilter === "all" ? undefined : statusFilter === "active";
      const [h, d] = await Promise.all([
        adminApi.getHospitals(search, isActive),
        adminApi.getDoctors(undefined, true),
      ]);
      setHospitals(h);
      setDoctors(d);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to load hospitals"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => hospitals, [hospitals]);

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

  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        id: d.id,
        label: d.fullName,
        badge: d.uniqueCode || undefined,
        secondary: d.specialization || undefined,
        searchText: [d.fullName, d.uniqueCode, d.email, d.specialization, d.contactNumber]
          .filter(Boolean)
          .join(" "),
      })),
    [doctors],
  );

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
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
          <Button variant="secondary" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-40" />
            <p>No hospitals yet. Add one with address and map pin.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((h) => (
              <div key={h.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{h.name}</p>
                    <Badge variant={h.isActive ? "default" : "secondary"}>{h.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[h.addressLine1, h.city, h.state, h.postalCode].filter(Boolean).join(", ") || "No address"}
                  </p>
                  {h.doctorNames && h.doctorNames.length > 0 && (
                    <p className="text-xs text-muted-foreground">Doctors: {h.doctorNames.join(", ")}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(h)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void remove(h)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
