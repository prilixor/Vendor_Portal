import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { adminApi, AdminPermissionDto, AdminRoleDto } from "@/app/services/adminApi";
import { cn } from "@/app/helpers/utils";
import {
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_VISUAL: Record<
  string,
  { icon: typeof Shield; accent: string; iconBg: string; strip: string; label: string }
> = {
  super_admin: {
    icon: ShieldCheck,
    accent: "text-primary",
    iconBg: "bg-primary/10 text-primary ring-1 ring-primary/15",
    strip: "bg-primary",
    label: "Full platform access",
  },
  operations_admin: {
    icon: Settings,
    accent: "text-muted-foreground",
    iconBg: "bg-muted text-foreground/70 ring-1 ring-border",
    strip: "bg-foreground/25",
    label: "Orders & operations",
  },
  verifier: {
    icon: Users,
    accent: "text-muted-foreground",
    iconBg: "bg-muted text-foreground/70 ring-1 ring-border",
    strip: "bg-foreground/25",
    label: "Vendor verification",
  },
};

function roleVisual(code: string) {
  return (
    ROLE_VISUAL[code] ?? {
      icon: Shield,
      accent: "text-muted-foreground",
      iconBg: "bg-muted text-muted-foreground ring-1 ring-border",
      strip: "bg-muted-foreground/25",
      label: "Custom role",
    }
  );
}

function categoryCoverage(
  role: AdminRoleDto,
  permissions: AdminPermissionDto[],
): { category: string; enabled: number; total: number }[] {
  const map = new Map<string, { enabled: number; total: number }>();
  const enabled = new Set(role.permissionCodes);
  for (const p of permissions) {
    const cur = map.get(p.category) ?? { enabled: 0, total: 0 };
    cur.total += 1;
    if (enabled.has(p.code)) cur.enabled += 1;
    map.set(p.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .filter((c) => c.enabled > 0)
    .sort((a, b) => b.enabled - a.enabled);
}

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
  const [permSearch, setPermSearch] = useState("");
  const [listSearch, setListSearch] = useState("");

  const byCategory = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    const map = new Map<string, AdminPermissionDto[]>();
    for (const p of permissions) {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.code.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q)
      ) {
        continue;
      }
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions, permSearch]);

  const filteredRoles = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [roles, listSearch]);

  const stats = useMemo(() => {
    const system = roles.filter((r) => r.isSystem).length;
    const custom = roles.length - system;
    return {
      total: roles.length,
      system,
      custom,
      permissions: permissions.length,
    };
  }, [roles, permissions]);

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
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setSelected([]);
    setPermSearch("");
    setOpen(true);
  };

  const openEdit = (role: AdminRoleDto) => {
    setEditing(role);
    setCode(role.code);
    setName(role.name);
    setDescription(role.description ?? "");
    setSelected([...role.permissionCodes]);
    setPermSearch("");
    setOpen(true);
  };

  const isLockedSystemSuperAdmin = editing?.code === "super_admin";

  const toggle = (perm: string) => {
    if (isLockedSystemSuperAdmin) return;
    setSelected((prev) => (prev.includes(perm) ? prev.filter((x) => x !== perm) : [...prev, perm]));
  };

  const toggleCategory = (perms: AdminPermissionDto[], allSelected: boolean) => {
    if (isLockedSystemSuperAdmin) return;
    const codes = perms.map((p) => p.code);
    setSelected((prev) => {
      if (allSelected) return prev.filter((c) => !codes.includes(c));
      const next = new Set(prev);
      codes.forEach((c) => next.add(c));
      return [...next];
    });
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
        description="Define what each admin role can access across the console."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Roles" },
        ]}
        actions={
          <Button onClick={openCreate} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" /> New role
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total roles", value: stats.total, icon: Shield },
          { label: "System roles", value: stats.system, icon: Lock },
          { label: "Custom roles", value: stats.custom, icon: Pencil },
          { label: "Permissions", value: stats.permissions, icon: KeyRound },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{loading ? "—" : s.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground">
                <s.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 overflow-hidden shadow-sm p-0">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-medium">
              Role directory
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {loading ? "…" : `${filteredRoles.length} role${filteredRoles.length === 1 ? "" : "s"}`}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">System roles are seeded; SuperAdmin access is locked.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 bg-background pl-8"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search roles…"
              disabled={loading}
            />
          </div>
        </div>

        {loading ? (
          <PageLoaderSlot />
        ) : filteredRoles.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No roles match your search</p>
            <p className="text-xs text-muted-foreground">Try another name or clear the filter.</p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredRoles.map((role) => {
              const locked = role.code === "super_admin";
              const visual = roleVisual(role.code);
              const Icon = visual.icon;
              const coverage = categoryCoverage(role, permissions).slice(0, 4);
              const permPct =
                permissions.length > 0
                  ? Math.round((role.permissionCodes.length / permissions.length) * 100)
                  : 0;

              return (
                <article
                  key={role.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                    "hover:shadow-md hover:border-border",
                    locked ? "border-primary/20" : "border-border/70",
                  )}
                >
                  <div className={cn("h-1 w-full", visual.strip)} />

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                            visual.iconBg,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-semibold tracking-tight truncate">{role.name}</h3>
                            {locked && (
                              <Badge
                                variant="outline"
                                className="h-5 gap-0.5 border-primary/25 bg-primary/5 px-1.5 text-[10px] text-primary"
                              >
                                <Lock className="h-2.5 w-2.5" /> Locked
                              </Badge>
                            )}
                            {!role.isActive && (
                              <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">{role.code}</p>
                          <p className={cn("mt-1 text-[11px] font-medium", visual.accent)}>{visual.label}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 min-h-[2.75rem]">
                      {role.description || "No description provided for this role."}
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-muted-foreground">Access coverage</span>
                        <span className="tabular-nums text-muted-foreground">
                          {role.permissionCodes.length}/{permissions.length || "—"} · {permPct}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", locked ? "bg-primary" : "bg-foreground/70")}
                          style={{ width: `${Math.min(100, permPct)}%` }}
                        />
                      </div>
                      {coverage.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {coverage.map((c) => (
                            <span
                              key={c.category}
                              className="inline-flex items-center rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              title={`${c.enabled} of ${c.total} in ${c.category}`}
                            >
                              {c.category}
                              <span className="ml-1 tabular-nums opacity-70">
                                {c.enabled}/{c.total}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                          <KeyRound className="h-3 w-3" />
                          {role.permissionCodes.length} permissions
                        </Badge>
                        {role.isSystem && !locked && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            System
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={locked ? "outline" : "secondary"}
                        className="shrink-0"
                        onClick={() => openEdit(role)}
                      >
                        {locked ? (
                          <>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                          </>
                        ) : (
                          <>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            // Mobile: use almost full viewport (fixes narrow centered card)
            "left-1/2 top-1/2 w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)]",
            "h-[min(92dvh,100%)] max-h-[92dvh]",
            // Desktop
            "sm:w-full sm:max-w-2xl sm:h-auto sm:max-h-[min(90dvh,42rem)]",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
            <DialogTitle className="text-left">
              {editing ? (isLockedSystemSuperAdmin ? "View role" : "Edit role") : "Create role"}
            </DialogTitle>
            <p className="text-left text-sm font-normal text-muted-foreground">
              {isLockedSystemSuperAdmin
                ? "This system role has full access and cannot be modified."
                : "Update the role details and choose which permissions to grant."}
            </p>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 [scrollbar-width:thin]">
            <div className="space-y-5 sm:space-y-6">
              {isLockedSystemSuperAdmin && (
                <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2.5">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Permissions for SuperAdmin are locked by the system.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {!editing && (
                  <div className="space-y-1.5">
                    <Label htmlFor="role-code">Code</Label>
                    <Input
                      id="role-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="support_agent"
                      className="h-10 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Support Agent"
                    disabled={isLockedSystemSuperAdmin}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe what this role can do"
                    disabled={isLockedSystemSuperAdmin}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-3">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">Permissions</h3>
                      <p className="text-xs text-muted-foreground">
                        {selected.length} of {permissions.length} assigned
                      </p>
                    </div>
                  </div>
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-10 pl-8"
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder="Filter permissions…"
                      aria-label="Filter permissions"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border">
                  {byCategory.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No permissions match your filter.
                    </p>
                  ) : (
                    byCategory.map(([category, perms], catIdx) => {
                      const selectedInCat = perms.filter((p) => selected.includes(p.code)).length;
                      const allSelected = selectedInCat === perms.length && perms.length > 0;
                      return (
                        <div key={category} className={cn(catIdx > 0 && "border-t")}>
                          <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2.5 sm:px-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {category}
                              </span>
                              <span className="tabular-nums text-[11px] text-muted-foreground">
                                {selectedInCat}/{perms.length}
                              </span>
                            </div>
                            {!isLockedSystemSuperAdmin && (
                              <button
                                type="button"
                                className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
                                onClick={() => toggleCategory(perms, allSelected)}
                              >
                                {allSelected ? "Deselect all" : "Select all"}
                              </button>
                            )}
                          </div>
                          <ul>
                            {perms.map((p) => {
                              const checked = selected.includes(p.code);
                              return (
                                <li key={p.code} className="border-b last:border-b-0">
                                  <label
                                    className={cn(
                                      "flex min-h-[3.25rem] cursor-pointer gap-3 px-3 py-3 sm:px-4",
                                      "hover:bg-muted/40 active:bg-muted/60",
                                      isLockedSystemSuperAdmin && "cursor-default hover:bg-transparent active:bg-transparent",
                                    )}
                                  >
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={checked}
                                      onCheckedChange={() => toggle(p.code)}
                                      disabled={isLockedSystemSuperAdmin}
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-medium leading-5">{p.name}</span>
                                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {p.description || (
                                          <span className="font-mono">{p.code}</span>
                                        )}
                                      </span>
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-0 shrink-0 gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-end sm:space-x-2 sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => setOpen(false)}
            >
              {isLockedSystemSuperAdmin ? "Close" : "Cancel"}
            </Button>
            {!isLockedSystemSuperAdmin && (
              <Button
                type="button"
                className="h-11 w-full sm:h-9 sm:w-auto"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editing ? "Save" : "Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRoles;
