import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Skeleton } from "@/app/components/ui/skeleton";
import { adminApi, AdminUserDto } from "@/app/services/adminApi";
import { Plus, Shield, Users, Settings, Loader2, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";
import { safeFormatDistance } from "@/app/utils/dateUtils";
import { useAuth } from "@/app/guards/AuthContext";

const MAX_SUPER_ADMINS = 2;

const roleConfig: Record<string, { label: string; icon: typeof Shield; cls: string }> = {
  super_admin: { label: "Super admin", icon: Shield, cls: "bg-primary-soft text-primary" },
  verifier: { label: "Verifier", icon: Users, cls: "bg-info-soft text-info" },
  operations_admin: { label: "Operations admin", icon: Settings, cls: "bg-success-soft text-success" },
};

const Admins = () => {
  const { user, hasPermission } = useAuth();
  const [admins, setAdmins] = useState<AdminUserDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("verifier");
  const [roles, setRoles] = useState<{ code: string; name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const message = error instanceof Error ? error.message : "Failed to load admin users.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const creatableRoles = useMemo(() => {
    const list = roles.length > 0 ? roles : [
      { code: "super_admin", name: "Super admin" },
      { code: "verifier", name: "Verifier" },
      { code: "operations_admin", name: "Operations admin" },
    ];
    return list.filter((r) => r.code !== "super_admin" || superAdminCount < MAX_SUPER_ADMINS);
  }, [roles, superAdminCount]);

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
    setLoading(true);
    try {
      await adminApi.registerAdminUser({
        email,
        password,
        fullName: name,
        role,
        isActive: true,
      });
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("verifier");
      toast.success("Admin user added");
      await loadAdmins();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add admin user.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Admin management"
        description={`Add admins and assign roles. SuperAdmin limit: ${superAdminCount}/${MAX_SUPER_ADMINS}. System SuperAdmins are protected.`}
        actions={
          hasPermission("admins.manage") ? (
            <Button
              onClick={() => {
                setFieldErrors({});
                setRole(creatableRoles[0]?.code ?? "verifier");
                setOpen(true);
              }}
              className="bg-gradient-primary shadow-glow"
            >
              <Plus className="mr-2 h-4 w-4" /> Add admin
            </Button>
          ) : undefined
        }
      />

      <Card className="border-border/60 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <ul className="divide-y divide-border animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((a) => {
              const cfg = roleConfig[a.role] ?? {
                label: a.role,
                icon: Users,
                cls: "bg-muted text-muted-foreground",
              };
              const Icon = cfg.icon;
              const initials = a.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("");
              const protectedUser = !!a.isSystemUser || a.role === "super_admin";
              return (
                <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {a.fullName}
                        {protectedUser && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                            <Lock className="h-3 w-3" /> Protected
                          </span>
                        )}
                        {a.id === user?.id && (
                          <span className="text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {a.lastLoginAt && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        Last login {safeFormatDistance(a.lastLoginAt)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Add admin user</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">
            Fields marked <span className="text-destructive">*</span> are required.
            {superAdminCount >= MAX_SUPER_ADMINS && (
              <> SuperAdmin slots are full ({MAX_SUPER_ADMINS}/{MAX_SUPER_ADMINS}).</>
            )}
          </p>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={1}>
              <div className="space-y-1.5">
                <Label required>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError("name");
                  }}
                  placeholder="Jane Doe"
                  className={fieldErrors.name ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-1.5">
                <Label required>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="jane@portal.com"
                  type="email"
                  className={fieldErrors.email ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-1.5">
                <Label required>Password</Label>
                <Input
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  placeholder="••••••••"
                  type="password"
                  className={fieldErrors.password ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.password} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v: string) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {creatableRoles.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
            <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setFieldErrors({}); }}>Cancel</Button>
            <Button onClick={add} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admins;
