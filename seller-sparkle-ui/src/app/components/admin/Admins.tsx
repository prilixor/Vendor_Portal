import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { Switch } from "@/app/components/ui/switch";
import { adminApi, AdminUserDto } from "@/app/services/adminApi";
import {
  Plus,
  Shield,
  Users,
  Settings,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  Mail,
  Clock,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";
import { safeFormatDistance } from "@/app/utils/dateUtils";
import { useAuth } from "@/app/guards/AuthContext";
import { cn } from "@/app/helpers/utils";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";

const MAX_SUPER_ADMINS = 2;

const roleConfig: Record<string, { label: string; icon: typeof Shield; cls: string }> = {
  super_admin: { label: "Super admin", icon: Shield, cls: "bg-primary-soft text-primary" },
  verifier: { label: "Verifier", icon: Users, cls: "bg-info-soft text-info" },
  operations_admin: { label: "Operations admin", icon: Settings, cls: "bg-success-soft text-success" },
};

type DialogMode = "create" | "view" | "edit" | "resetPassword" | null;

const Admins = () => {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("admins.manage");
  const actorIsSuper = user?.adminRole === "super_admin" || user?.role === "super_admin";

  const [admins, setAdmins] = useState<AdminUserDto[]>([]);
  const [mode, setMode] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<AdminUserDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("verifier");
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState<{ code: string; name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resetCustomPassword, setResetCustomPassword] = useState("");
  const [useCustomResetPassword, setUseCustomResetPassword] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copiedTemp, setCopiedTemp] = useState(false);

  const superAdminCount = useMemo(
    () => admins.filter((a) => a.role === "super_admin" && a.isActive !== false).length,
    [admins],
  );

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  useEffect(() => {
    loadAdmins();
    adminApi.getAdminRoles().then((r) => setRoles(r.map((x) => ({ code: x.code, name: x.name })))).catch(() => {
      setRoles([
        { code: "super_admin", name: "Super admin" },
        { code: "verifier", name: "Verifier" },
        { code: "operations_admin", name: "Operations admin" },
      ]);
    });
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAdminUsers();
      setAdmins(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin users.");
    } finally {
      setLoading(false);
    }
  };

  const roleOptionsForEdit = useMemo(() => {
    const list = roles.length > 0 ? roles : [
      { code: "super_admin", name: "Super admin" },
      { code: "verifier", name: "Verifier" },
      { code: "operations_admin", name: "Operations admin" },
    ];
    return list.filter((r) => {
      if (r.code !== "super_admin") return true;
      if (selected?.role === "super_admin") return true;
      return superAdminCount < MAX_SUPER_ADMINS;
    });
  }, [roles, superAdminCount, selected]);

  const creatableRoles = useMemo(() => {
    const list = roles.length > 0 ? roles : [
      { code: "super_admin", name: "Super admin" },
      { code: "verifier", name: "Verifier" },
      { code: "operations_admin", name: "Operations admin" },
    ];
    return list.filter((r) => r.code !== "super_admin" || superAdminCount < MAX_SUPER_ADMINS);
  }, [roles, superAdminCount]);

  const closeDialog = () => {
    setMode(null);
    setSelected(null);
    setFieldErrors({});
    setPassword("");
    setResetCustomPassword("");
    setUseCustomResetPassword(false);
    setShowCreatePassword(false);
    setShowResetPassword(false);
    setTempPasswordResult(null);
    setCopiedTemp(false);
  };

  const openCreate = () => {
    setSelected(null);
    setName("");
    setEmail("");
    setPassword("");
    setShowCreatePassword(false);
    setRole(creatableRoles[0]?.code ?? "verifier");
    setIsActive(true);
    setFieldErrors({});
    setMode("create");
  };

  const openView = (admin: AdminUserDto) => {
    setSelected(admin);
    setMode("view");
  };

  const openEdit = (admin: AdminUserDto) => {
    const targetIsSuper = admin.role === "super_admin" || !!admin.isSystemUser;
    if (targetIsSuper && !actorIsSuper) {
      toast.error("Only a SuperAdmin can edit a SuperAdmin account.");
      return;
    }
    setSelected(admin);
    setName(admin.fullName);
    setEmail(admin.email);
    setRole(admin.role);
    setIsActive(admin.isActive !== false);
    setPassword("");
    setFieldErrors({});
    setMode("edit");
  };

  const canEditRow = (admin: AdminUserDto) => {
    if (!canManage) return false;
    const targetIsSuper = admin.role === "super_admin" || !!admin.isSystemUser;
    if (targetIsSuper && !actorIsSuper) return false;
    return true;
  };

  const canResetPassword = (admin: AdminUserDto) =>
    actorIsSuper && admin.id !== user?.id;

  const openResetPassword = (admin: AdminUserDto) => {
    if (!canResetPassword(admin)) {
      toast.error("Only a SuperAdmin can reset another admin's password.");
      return;
    }
    setSelected(admin);
    setResetCustomPassword("");
    setUseCustomResetPassword(false);
    setShowResetPassword(false);
    setTempPasswordResult(null);
    setCopiedTemp(false);
    setFieldErrors({});
    setMode("resetPassword");
  };

  const submitResetPassword = async () => {
    if (!selected) return;
    if (useCustomResetPassword) {
      if (!resetCustomPassword || resetCustomPassword.length < 8) {
        setFieldErrors({ resetPassword: "Temporary password must be at least 8 characters." });
        toast.error("Please enter a valid temporary password.");
        return;
      }
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await adminApi.forceResetAdminPassword(selected.id, {
        newPassword: useCustomResetPassword ? resetCustomPassword : undefined,
        notes: `Force reset by SuperAdmin for ${selected.email}`,
      });
      setTempPasswordResult(result.temporaryPassword);
      toast.success("Temporary password created. Copy and share it securely.");
      await loadAdmins();
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const copyTempPassword = async () => {
    if (!tempPasswordResult) return;
    try {
      await navigator.clipboard.writeText(tempPasswordResult);
      setCopiedTemp(true);
      toast.success("Temporary password copied.");
      setTimeout(() => setCopiedTemp(false), 2000);
    } catch {
      toast.error("Could not copy. Select and copy manually.");
    }
  };

  /** Field-level edit rules for the Edit dialog (matches API). */
  const editFieldRules = useMemo(() => {
    if (!selected) {
      return { isSelf: false, canEditRole: false, canEditActive: false, banner: null as string | null };
    }
    const isSelf = selected.id === user?.id;
    const targetIsSuper = selected.role === "super_admin" || !!selected.isSystemUser;
    const isLastActiveSuper =
      targetIsSuper && selected.isActive !== false && superAdminCount <= 1;

    // Anyone editing themselves: name + email only
    if (isSelf) {
      return {
        isSelf: true,
        canEditRole: false,
        canEditActive: false,
        banner:
          "You are editing your own account. You can update name and email only. Role and active status cannot be changed here.",
      };
    }

    // Only SuperAdmin can change roles
    const canEditRole =
      actorIsSuper &&
      !(selected.isSystemUser && targetIsSuper) && // system SuperAdmin cannot be demoted
      !isLastActiveSuper; // last SuperAdmin cannot be demoted

    // Active: SuperAdmin can toggle others except last active SuperAdmin
    const canEditActive = !(targetIsSuper && isLastActiveSuper);

    let banner: string | null = null;
    if (targetIsSuper) {
      if (selected.isSystemUser || isLastActiveSuper) {
        banner =
          "Protected SuperAdmin. Name and email can be updated. Role and active status are locked by system rules.";
      } else {
        banner =
          "SuperAdmin account. Name, email, role, and active status can be updated (while another SuperAdmin remains).";
      }
    } else if (!actorIsSuper) {
      banner = "You can update name, email, and active status. Only a SuperAdmin can change roles.";
    }

    return {
      isSelf: false,
      canEditRole: actorIsSuper ? canEditRole : false,
      canEditActive,
      banner,
    };
  }, [selected, user?.id, actorIsSuper, superAdminCount]);

  const add = async () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Please enter the admin's name.";
    if (!email.trim()) errors.email = "Please enter an email address.";
    if (!password) errors.password = "Please enter a password.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }
    if (role === "super_admin" && superAdminCount >= MAX_SUPER_ADMINS) {
      toast.error(`At most ${MAX_SUPER_ADMINS} SuperAdmin accounts are allowed.`);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await adminApi.registerAdminUser({
        email,
        password,
        fullName: name,
        role,
        isActive: true,
      });
      toast.success("Admin user added");
      closeDialog();
      await loadAdmins();
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Please enter the admin's name.";
    if (!email.trim()) errors.email = "Please enter an email address.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: {
        fullName: string;
        email: string;
        role?: string;
        isActive?: boolean;
      } = {
        fullName: name.trim(),
        email: email.trim(),
      };
      // Only send role/active when the UI allows changing them (self = name/email only)
      if (editFieldRules.canEditRole) payload.role = role;
      if (editFieldRules.canEditActive) payload.isActive = isActive;

      await adminApi.updateAdminUser(selected.id, payload);
      toast.success("Admin user updated");
      closeDialog();
      await loadAdmins();
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (code: string) =>
    roleConfig[code]?.label ?? roles.find((r) => r.code === code)?.name ?? code;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin management"
        description={`Add admins and assign roles. SuperAdmin limit: ${superAdminCount}/${MAX_SUPER_ADMINS}. System SuperAdmins are protected.`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Admins" },
        ]}
        actions={
          canManage ? (
            <Button onClick={openCreate} className="bg-gradient-primary shadow-glow">
              <Plus className="mr-2 h-4 w-4" /> Add admin
            </Button>
          ) : undefined
        }
      />

      <Card className="border-border/60 p-0 overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/30 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Admin users
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {loading ? "…" : `${admins.length} account${admins.length === 1 ? "" : "s"}`}
            </span>
          </p>
        </div>

        {loading ? (
          <PageLoaderSlot />
        ) : admins.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">No admin users yet</p>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={openCreate}>
                Add first admin
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((a) => {
              const cfg = roleConfig[a.role] ?? {
                label: roleLabel(a.role),
                icon: Users,
                cls: "bg-muted text-muted-foreground",
              };
              const Icon = cfg.icon;
              const initials = a.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?";
              const protectedUser = !!a.isSystemUser || a.role === "super_admin";
              const inactive = a.isActive === false;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                    inactive && "opacity-70 bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold flex flex-wrap items-center gap-2">
                        <span className="truncate">{a.fullName}</span>
                        {protectedUser && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            <Lock className="h-3 w-3" /> Protected
                          </span>
                        )}
                        {a.id === user?.id && (
                          <span className="text-[10px] text-muted-foreground">(you)</span>
                        )}
                        {a.mustChangePassword && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200">
                            Must change password
                          </Badge>
                        )}
                        {inactive && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <CopyableEmail email={a.email} textClassName="text-xs text-muted-foreground" />
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:flex-nowrap pl-13 sm:pl-0">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {a.lastLoginAt && (
                      <span className="hidden text-xs text-muted-foreground lg:inline">
                        Last login {safeFormatDistance(a.lastLoginAt)}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                      <Button type="button" variant="outline" size="sm" onClick={() => openView(a)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                      </Button>
                      {canEditRow(a) && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                        </Button>
                      )}
                      {canResetPassword(a) && (
                        <Button type="button" variant="outline" size="sm" onClick={() => openResetPassword(a)}>
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset password
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Create */}
      <Dialog open={mode === "create"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add admin user</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1 mb-2">
            Fields marked <span className="text-destructive">*</span> are required.
            {superAdminCount >= MAX_SUPER_ADMINS && (
              <> SuperAdmin slots are full ({MAX_SUPER_ADMINS}/{MAX_SUPER_ADMINS}).</>
            )}
          </p>
          <FormGrid cols={1}>
            <div className="space-y-1.5">
              <Label required>Name</Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                placeholder="Jane Doe"
                className={fieldErrors.name ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.name} />
            </div>
            <div className="space-y-1.5">
              <Label required>Email</Label>
              <Input
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                placeholder="jane@portal.com"
                type="email"
                className={fieldErrors.email ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-1.5">
              <Label required>Password</Label>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                  placeholder="••••••••"
                  type={showCreatePassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={fieldErrors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCreatePassword ? "Hide password" : "Show password"}
                >
                  {showCreatePassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {creatableRoles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormGrid>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={mode === "view" && !!selected} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-primary text-sm font-semibold text-primary-foreground">
                    {selected.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{selected.fullName}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {roleLabel(selected.role)}
                    </Badge>
                    {(selected.isSystemUser || selected.role === "super_admin") && (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 gap-1">
                        <Lock className="h-3 w-3" /> Protected
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        selected.isActive === false
                          ? "text-muted-foreground"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200",
                      )}
                    >
                      {selected.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border divide-y text-sm">
                <div className="flex items-start gap-2.5 px-3.5 py-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium break-all">
                      <CopyableEmail
                        email={selected.email}
                        compact={false}
                        textClassName="font-medium break-all"
                      />
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 px-3.5 py-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last login</p>
                    <p className="font-medium">
                      {selected.lastLoginAt ? safeFormatDistance(selected.lastLoginAt) : "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Close</Button>
            {selected && canResetPassword(selected) && (
              <Button variant="secondary" onClick={() => openResetPassword(selected)}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset password
              </Button>
            )}
            {selected && canEditRow(selected) && (
              <Button onClick={() => openEdit(selected)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={mode === "edit" && !!selected} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit admin user</DialogTitle>
          </DialogHeader>
          {editFieldRules.banner && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {editFieldRules.banner}
            </div>
          )}
          <FormGrid cols={1}>
            <div className="space-y-1.5">
              <Label required>Name</Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                className={fieldErrors.name ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.name} />
            </div>
            <div className="space-y-1.5">
              <Label required>Email</Label>
              <Input
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                type="email"
                className={fieldErrors.email ? "border-destructive" : ""}
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={setRole}
                disabled={!editFieldRules.canEditRole}
              >
                <SelectTrigger className={!editFieldRules.canEditRole ? "opacity-60" : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptionsForEdit.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editFieldRules.canEditRole && (
                <p className="text-xs text-muted-foreground">
                  {editFieldRules.isSelf
                    ? "You cannot change your own role."
                    : actorIsSuper
                      ? "Role is locked for this SuperAdmin."
                      : "Only a SuperAdmin can change roles."}
                </p>
              )}
            </div>
            <div className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5",
              !editFieldRules.canEditActive && "opacity-60",
            )}>
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  {editFieldRules.canEditActive
                    ? "Inactive users cannot sign in."
                    : editFieldRules.isSelf
                      ? "You cannot deactivate your own account here."
                      : "Active status is locked for this SuperAdmin."}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!editFieldRules.canEditActive}
              />
            </div>
          </FormGrid>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password (SuperAdmin only) */}
      <Dialog open={mode === "resetPassword" && !!selected} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset admin password</DialogTitle>
          </DialogHeader>
          {selected && !tempPasswordResult && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Creates a temporary password for <strong className="mx-1">{selected.fullName}</strong>
                ({selected.email}). The current password is never shown. They must change it after signing in.
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={useCustomResetPassword}
                  onChange={(e) => {
                    setUseCustomResetPassword(e.target.checked);
                    clearFieldError("resetPassword");
                  }}
                />
                <span>
                  Set a custom temporary password
                  <span className="block text-xs text-muted-foreground">
                    Leave unchecked to generate a secure password automatically.
                  </span>
                </span>
              </label>
              {useCustomResetPassword && (
                <div className="space-y-1.5">
                  <Label required>Temporary password</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showResetPassword ? "text" : "password"}
                      value={resetCustomPassword}
                      onChange={(e) => {
                        setResetCustomPassword(e.target.value);
                        clearFieldError("resetPassword");
                      }}
                      className={fieldErrors.resetPassword ? "border-destructive" : ""}
                      autoComplete="new-password"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowResetPassword((v) => !v)}
                      aria-label={showResetPassword ? "Hide password" : "Show password"}
                    >
                      {showResetPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FieldError message={fieldErrors.resetPassword} />
                </div>
              )}
            </div>
          )}
          {tempPasswordResult && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-900">
                Temporary password created. Copy it now — it is shown only once and is not stored in plain text.
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input value={tempPasswordResult} readOnly className="font-mono text-sm" />
                  <Button type="button" variant="outline" size="icon" onClick={() => void copyTempPassword()}>
                    {copiedTemp ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Share it securely (e.g. phone/secure chat). After login they should open Settings and set a new password.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {tempPasswordResult ? "Done" : "Cancel"}
            </Button>
            {!tempPasswordResult && (
              <Button onClick={() => void submitResetPassword()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Reset password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admins;
