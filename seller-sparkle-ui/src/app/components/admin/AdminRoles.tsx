import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { adminApi, AdminPermissionDto, AdminRoleDto } from "@/app/services/adminApi";
import { Loader2, Plus, Shield } from "lucide-react";
import { toast } from "sonner";

const AdminRoles = () => {
  const [roles, setRoles] = useState<AdminRoleDto[]>([]);
  const [permissions, setPermissions] = useState<AdminPermissionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRoleDto | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const byCategory = useMemo(() => {
    const map = new Map<string, AdminPermissionDto[]>();
    for (const p of permissions) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()];
  }, [permissions]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([adminApi.getAdminRoles(), adminApi.getAdminPermissions()]);
      setRoles(r);
      setPermissions(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setSelected([]);
    setOpen(true);
  };

  const openEdit = (role: AdminRoleDto) => {
    setEditing(role);
    setCode(role.code);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelected([...role.permissionCodes]);
    setOpen(true);
  };

  const isLockedSystemSuperAdmin = editing?.code === "super_admin";

  const toggle = (perm: string) => {
    if (isLockedSystemSuperAdmin) return;
    setSelected((prev) => (prev.includes(perm) ? prev.filter((x) => x !== perm) : [...prev, perm]));
  };

  const save = async () => {
    if (isLockedSystemSuperAdmin) {
      toast.error("The SuperAdmin system role is locked and cannot be edited.");
      return;
    }
    if (!name.trim() || selected.length === 0) {
      toast.error("Name and at least one permission are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateAdminRole(editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          isActive: editing.isActive,
          permissionCodes: selected,
        });
        toast.success("Role updated");
      } else {
        if (!/^[a-z][a-z0-9_]*$/.test(code.trim())) {
          toast.error("Code must be lowercase snake_case");
          setSaving(false);
          return;
        }
        await adminApi.createAdminRole({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          permissionCodes: selected,
        });
        toast.success("Role created");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create roles and assign screen/action access for admin staff."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New role
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <Shield className="h-4 w-4 text-primary" />
                    {role.name}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{role.code}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                  Edit
                </Button>
              </div>
              {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
              <p className="text-xs text-muted-foreground">{role.permissionCodes.length} permissions</p>
              {role.isSystem && <p className="text-xs text-primary">System role{role.code === "super_admin" ? " (locked)" : ""}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
          </DialogHeader>
          {isLockedSystemSuperAdmin && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              SuperAdmin is a protected system role. Permissions are always full and cannot be changed.
            </p>
          )}
          <div className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="support_agent" disabled={!!editing} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Agent" disabled={isLockedSystemSuperAdmin} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLockedSystemSuperAdmin} />
            </div>
            <div className="space-y-3">
              <Label>Permissions</Label>
              {byCategory.map(([category, perms]) => (
                <div key={category} className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">{category}</p>
                  {perms.map((p) => (
                    <label key={p.code} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(p.code)}
                        onCheckedChange={() => toggle(p.code)}
                        disabled={isLockedSystemSuperAdmin}
                      />
                      <span>
                        <span className="font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{p.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || isLockedSystemSuperAdmin}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRoles;
