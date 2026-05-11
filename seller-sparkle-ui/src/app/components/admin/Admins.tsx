import { useState, useEffect } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { Skeleton } from "@/app/components/ui/skeleton";
import { adminApi, AdminUserDto } from "@/app/services/adminApi";
import { Plus, Shield, Users, Settings, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const roleConfig = {
  super_admin: { label: "Super admin", icon: Shield, cls: "bg-primary-soft text-primary" },
  verifier: { label: "Verifier", icon: Users, cls: "bg-info-soft text-info" },
  operations_admin: { label: "Operations admin", icon: Settings, cls: "bg-success-soft text-success" },
};

const Admins = () => {
  const [admins, setAdmins] = useState<AdminUserDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("verifier");

  useEffect(() => {
    loadAdmins();
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

  const add = async () => {
    if (!name || !email || !password) {
      toast.error("Name, email, and password are required");
      return;
    }
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
        description="Add or remove admin users and assign their roles."
        actions={
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" /> Add admin
          </Button>
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
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border">
            {admins.map((a) => {
              const cfg = roleConfig[a.role];
              const Icon = cfg.icon;
              const initials = a.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("");
              return (
                <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {cfg.label}
                    </span>
                    {a.lastLoginAt && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        Last login {formatDistanceToNow(new Date(a.lastLoginAt), { addSuffix: true })}
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
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={1}>
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@portal.com" type="email" /></div>
              <div className="space-y-1.5"><Label>Password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" /></div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                    <SelectItem value="verifier">Verifier</SelectItem>
                    <SelectItem value="operations_admin">Operations admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
            <div className="h-5" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Create user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admins;


