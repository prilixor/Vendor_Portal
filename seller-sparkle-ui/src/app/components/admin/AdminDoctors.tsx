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
import {
  adminApi,
  AdminDoctorDto,
  CreateAdminDoctorRequest,
  UpdateAdminDoctorRequest,
} from "@/app/services/adminApi";
import { Copy, Download, Loader2, Mail, Pencil, Plus, Search, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type DoctorForm = {
  fullName: string;
  email: string;
  specialization: string;
  contactNumber: string;
  isActive: boolean;
  sendEmail: boolean;
};

const emptyForm = (): DoctorForm => ({
  fullName: "",
  email: "",
  specialization: "",
  contactNumber: "",
  isActive: true,
  sendEmail: true,
});

const AdminDoctors = () => {
  const [doctors, setDoctors] = useState<AdminDoctorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDoctorDto | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const isActive = statusFilter === "all" ? undefined : statusFilter === "active";
      const data = await adminApi.getDoctors(search, isActive);
      setDoctors(data);
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
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required";
    if (!form.email.trim() || !form.email.includes("@")) errors.email = "Valid email is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const payload: UpdateAdminDoctorRequest = {
          id: editing.id,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          specialization: form.specialization.trim() || undefined,
          contactNumber: form.contactNumber.trim() || undefined,
          isActive: form.isActive,
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
    try {
      await adminApi.downloadDoctorQr(d.id, d.uniqueCode);
    } catch (e) {
      toast.error(getUserFriendlyMessage(e, "Failed to download QR"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor References"
        description="Admin-curated doctors with Unique IDs and QR share pages for patients."
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
                    {d.contactNumber ? ` · ${d.contactNumber}` : ""}
                  </p>
                  {d.publicPageUrl && (
                    <a
                      href={d.publicPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {d.publicPageUrl}
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void downloadQr(d)}>
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
        <DialogContent className="max-w-lg">
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
              {!editing && (
                <p className="text-xs text-muted-foreground">
                  Unique ID is generated on save (e.g. Dr. Aditi Patel → DRAP2601).
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="doctor@clinic.com"
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
                placeholder="Orthopedics"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact number</Label>
              <Input
                value={form.contactNumber}
                onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
                placeholder="+91…"
              />
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
                  <p className="text-xs text-muted-foreground">Sent to the registered email on create.</p>
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
    </div>
  );
};

export default AdminDoctors;
