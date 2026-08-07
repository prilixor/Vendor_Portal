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
  AdminDoctorDto,
  AdminHospitalDto,
  AdminHospitalInput,
  CreateAdminDoctorRequest,
  UpdateAdminDoctorRequest,
} from "@/app/services/adminApi";
import { missingAddressFieldLabels } from "@/app/helpers/reverseGeocode";
import { Copy, Download, ExternalLink, Loader2, Mail, Pencil, Plus, Search, Stethoscope, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { downloadDoctorQrCard } from "@/app/helpers/downloadDoctorQrCard";

type DoctorForm = {
  fullName: string;
  email: string;
  specialization: string;
  contactNumber: string;
  isActive: boolean;
  sendEmail: boolean;
  hospitalIds: string[];
};

type NewHospitalDraft = AdminHospitalInput & { key: string };

const emptyForm = (): DoctorForm => ({
  fullName: "",
  email: "",
  specialization: "",
  contactNumber: "",
  isActive: true,
  sendEmail: true,
  hospitalIds: [],
});

const emptyNewHospital = (): NewHospitalDraft => ({
  key: crypto.randomUUID(),
  name: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  contactNumber: "",
  latitude: 23.0225,
  longitude: 72.5714,
});

const AdminDoctors = () => {
  const [doctors, setDoctors] = useState<AdminDoctorDto[]>([]);
  const [hospitals, setHospitals] = useState<AdminHospitalDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDoctorDto | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm());
  const [newHospitals, setNewHospitals] = useState<NewHospitalDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [qrDoctor, setQrDoctor] = useState<AdminDoctorDto | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const isActive = statusFilter === "all" ? undefined : statusFilter === "active";
      const [docs, hosps] = await Promise.all([
        adminApi.getDoctors(search, isActive),
        adminApi.getHospitals(undefined, true),
      ]);
      setDoctors(docs);
      setHospitals(hosps);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to load doctors"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => doctors, [doctors]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setNewHospitals([]);
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (d: AdminDoctorDto) => {
    setEditing(d);
    setForm({
      fullName: d.fullName,
      email: d.email,
      specialization: d.specialization || "",
      contactNumber: d.contactNumber || "",
      isActive: d.isActive,
      sendEmail: false,
      hospitalIds: (d.hospitals || []).map((h) => h.id),
    });
    setNewHospitals([]);
    setFieldErrors({});
    setDialogOpen(true);
  };

  const hospitalOptions = useMemo(
    () =>
      hospitals.map((h) => ({
        id: h.id,
        label: h.name,
        secondary: [h.city, h.state].filter(Boolean).join(", ") || h.addressLine1 || undefined,
        searchText: [h.name, h.city, h.state, h.addressLine1, h.postalCode].filter(Boolean).join(" "),
      })),
    [hospitals],
  );

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required";
    if (!form.email.trim() || !form.email.includes("@")) errors.email = "Valid email is required";
    newHospitals.forEach((h, i) => {
      if (!h.name.trim()) errors[`newHospital_${i}`] = "Hospital name is required";
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const newHospitalPayload = newHospitals.map(({ key: _k, ...rest }) => ({
        ...rest,
        name: rest.name.trim(),
        addressLine1: rest.addressLine1?.trim() || undefined,
        city: rest.city?.trim() || undefined,
        state: rest.state?.trim() || undefined,
        postalCode: rest.postalCode?.trim() || undefined,
        contactNumber: rest.contactNumber?.trim() || undefined,
      }));

      if (editing) {
        const payload: UpdateAdminDoctorRequest = {
          id: editing.id,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          specialization: form.specialization.trim() || undefined,
          contactNumber: form.contactNumber.trim() || undefined,
          isActive: form.isActive,
          hospitalIds: form.hospitalIds,
          newHospitals: newHospitalPayload.length ? newHospitalPayload : undefined,
        };
        await adminApi.updateDoctor(editing.id, payload);
        toast.success("Doctor updated");
      } else {
        const payload: CreateAdminDoctorRequest = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          specialization: form.specialization.trim() || undefined,
          contactNumber: form.contactNumber.trim() || undefined,
          sendEmail: form.sendEmail,
          hospitalIds: form.hospitalIds,
          newHospitals: newHospitalPayload.length ? newHospitalPayload : undefined,
        };
        const created = await adminApi.createDoctor(payload);
        toast.success(`Doctor created — Unique ID ${created.uniqueCode}`);
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to save doctor"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: AdminDoctorDto) => {
    if (!confirm(`Deactivate and remove “${d.fullName}” (${d.uniqueCode})?`)) return;
    try {
      await adminApi.deleteDoctor(d.id);
      toast.success("Doctor removed");
      await load();
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to remove doctor"));
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Unique ID copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const resend = async (d: AdminDoctorDto) => {
    try {
      await adminApi.resendDoctorEmail(d.id);
      toast.success(`Email resent to ${d.email}`);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to resend email"));
    }
  };

  const downloadQr = async (d: AdminDoctorDto) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = qrDoctor?.id === d.id && qrUrl ? qrUrl : await adminApi.getDoctorQrObjectUrl(d.id);
      await downloadDoctorQrCard({
        qrImageUrl: objectUrl,
        fullName: d.fullName,
        uniqueCode: d.uniqueCode,
        specialization: d.specialization,
        fileName: `doctor-${d.uniqueCode}-card.png`,
      });
      toast.success("Doctor QR card downloaded");
    } catch (e) {
      toast.error(getUserFriendlyMessage(e) || "Failed to download QR card");
    } finally {
      if (objectUrl && objectUrl !== qrUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  const openQrPreview = async (d: AdminDoctorDto) => {
    setQrDoctor(d);
    setQrLoading(true);
    setQrUrl(null);
    try {
      const url = await adminApi.getDoctorQrObjectUrl(d.id);
      setQrUrl(url);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to load QR"));
      setQrDoctor(null);
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrPreview = () => {
    if (qrUrl) URL.revokeObjectURL(qrUrl);
    setQrUrl(null);
    setQrDoctor(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor References"
        description="Admin-curated doctors with Unique IDs, QR pages, and linked hospitals."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Doctor
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, email, or Unique ID…"
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
            <Stethoscope className="h-10 w-10 opacity-40" />
            <p>No doctors yet. Add the first doctor to generate a Unique ID and QR.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((d) => (
              <div key={d.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.fullName}</p>
                    <Badge variant={d.isActive ? "default" : "secondary"}>{d.isActive ? "Active" : "Inactive"}</Badge>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs"
                      onClick={() => void copyCode(d.uniqueCode)}
                      title="Copy Unique ID"
                    >
                      {d.uniqueCode}
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {d.email}
                    {d.specialization ? ` · ${d.specialization}` : ""}
                  </p>
                  {d.hospitals && d.hospitals.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Hospitals: {d.hospitals.map((h) => h.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void openQrPreview(d)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    QR
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void resend(d)}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Email
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void remove(d)}>
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
            <DialogTitle>{editing ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
          </DialogHeader>
          <FormGrid>
            <div className="space-y-2 sm:col-span-2">
              <Label>Full name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Dr. Aditi Patel"
              />
              <FieldError message={fieldErrors.fullName} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact number</Label>
              <Input
                value={form.contactNumber}
                onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
              />
            </div>

            <div className="sm:col-span-2">
              <SearchableMultiSelect
                label="Link existing hospitals"
                options={hospitalOptions}
                selectedIds={form.hospitalIds}
                onChange={(hospitalIds) => setForm((f) => ({ ...f, hospitalIds }))}
                placeholder="Select hospitals…"
                searchPlaceholder="Search by name, city, or address…"
                emptyMessage="No hospitals yet — add one below."
              />
            </div>

            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Add new hospital(s)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewHospitals((x) => [...x, emptyNewHospital()])}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New hospital
                </Button>
              </div>
              {newHospitals.map((h, index) => (
                <div key={h.key} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">New hospital #{index + 1}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setNewHospitals((list) => list.filter((x) => x.key !== h.key))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Hospital name *"
                    value={h.name}
                    onChange={(e) =>
                      setNewHospitals((list) => list.map((x) => (x.key === h.key ? { ...x, name: e.target.value } : x)))
                    }
                  />
                  <FieldError message={fieldErrors[`newHospital_${index}`]} />
                  <Input
                    placeholder="Address"
                    value={h.addressLine1 || ""}
                    onChange={(e) =>
                      setNewHospitals((list) =>
                        list.map((x) => (x.key === h.key ? { ...x, addressLine1: e.target.value } : x)),
                      )
                    }
                  />
                  <div className="space-y-2">
                    <StateCityFields
                      state={h.state || ""}
                      city={h.city || ""}
                      onStateChange={(state) =>
                        setNewHospitals((list) =>
                          list.map((x) => (x.key === h.key ? { ...x, state } : x)),
                        )
                      }
                      onCityChange={(city) =>
                        setNewHospitals((list) =>
                          list.map((x) => (x.key === h.key ? { ...x, city } : x)),
                        )
                      }
                    />
                    <Input
                      placeholder="Postal code"
                      value={h.postalCode || ""}
                      onChange={(e) =>
                        setNewHospitals((list) =>
                          list.map((x) => (x.key === h.key ? { ...x, postalCode: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <MapPicker
                    latitude={h.latitude ?? 23.0225}
                    longitude={h.longitude ?? 72.5714}
                    onChange={(lat, lng) =>
                      setNewHospitals((list) =>
                        list.map((x) => (x.key === h.key ? { ...x, latitude: lat, longitude: lng } : x)),
                      )
                    }
                    onAddressResolved={(address) => {
                      const nextLine1 = address?.line1 || h.addressLine1 || "";
                      const nextCity = address?.city || h.city || "";
                      const nextState = address?.state || h.state || "";
                      const nextPostal = address?.postal || h.postalCode || "";

                      if (address && (address.line1 || address.state || address.city || address.postal)) {
                        setNewHospitals((list) =>
                          list.map((x) =>
                            x.key === h.key
                              ? {
                                  ...x,
                                  ...(address.line1 ? { addressLine1: address.line1 } : {}),
                                  ...(address.state ? { state: address.state } : {}),
                                  ...(address.city ? { city: address.city } : {}),
                                  ...(address.postal ? { postalCode: address.postal } : {}),
                                }
                              : x,
                          ),
                        );
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
                    height="h-44"
                  />
                </div>
              ))}
            </div>

            {editing ? (
              <div className="flex items-center justify-between sm:col-span-2">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              </div>
            ) : (
              <div className="flex items-center justify-between sm:col-span-2">
                <div>
                  <Label>Email Unique ID &amp; QR link to doctor</Label>
                </div>
                <Switch checked={form.sendEmail} onCheckedChange={(v) => setForm((f) => ({ ...f, sendEmail: v }))} />
              </div>
            )}
          </FormGrid>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrDoctor}
        onOpenChange={(open) => {
          if (!open) closeQrPreview();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Doctor QR card</DialogTitle>
          </DialogHeader>
          {qrDoctor && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-700 to-emerald-900 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-100/80">BlinksMed Doctor</p>
                <p className="mt-2 text-xl font-bold">{qrDoctor.fullName}</p>
                {qrDoctor.specialization && (
                  <p className="mt-1 text-sm text-teal-50/85">{qrDoctor.specialization}</p>
                )}
                <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-wider text-teal-100/70">Unique ID</p>
                  <p className="font-mono text-lg font-bold tracking-wider">{qrDoctor.uniqueCode}</p>
                </div>
              </div>

              <div className="flex justify-center rounded-2xl border border-border bg-card p-4">
                {qrLoading || !qrUrl ? (
                  <div className="flex h-[220px] w-[220px] items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <img
                    src={qrUrl}
                    alt={`QR for ${qrDoctor.uniqueCode}`}
                    className="h-[220px] w-[220px] rounded-lg border border-border bg-white"
                  />
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Patients scan this code to open the doctor share page and copy the Unique ID for checkout.
              </p>

              {qrDoctor.publicPageUrl && /localhost|127\.0\.0\.1/i.test(qrDoctor.publicPageUrl) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Share URL uses <span className="font-semibold">localhost</span>, so phones cannot open it.
                  Set API <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">FrontendUrl</code> to your PC LAN IP
                  (e.g. <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">http://192.168.x.x:5173</code>) or a
                  deployed host, restart the API, then regenerate / resend this QR.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => void copyCode(qrDoctor.uniqueCode)}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy ID
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => void downloadQr(qrDoctor)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download card
                </Button>
                {qrDoctor.publicPageUrl && (
                  <Button className="w-full" asChild>
                    <a href={qrDoctor.publicPageUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open share page
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDoctors;
