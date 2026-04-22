import { useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { mockAdmins } from "@/app/services/mockData";
import { AdminUser } from "@/app/models";
import { Plus, Trash2, Shield, Users, Headphones } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const roleConfig = {
  super_admin: { label: "Super admin", icon: Shield, cls: "bg-primary-soft text-primary" },
  verifier: { label: "Verifier", icon: Users, cls: "bg-info-soft text-info" },
  support: { label: "Support", icon: Headphones, cls: "bg-success-soft text-success" },
};

const Admins = () => {
  const [admins, setAdmins] = useState<AdminUser[]>(mockAdmins);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("verifier");

  const add = () => {
    if (!name || !email) { toast.error("Name and email are required"); return; }
    setAdmins((a) => [...a, { id: `a${Date.now()}`, name, email, role, lastActive: new Date().toISOString() }]);
    setOpen(false); setName(""); setEmail("");
    toast.success("Admin user added");
  };
  const remove = (id: string) => { setAdmins((a) => a.filter((x) => x.id !== id)); toast.success("Admin removed"); };

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
        <ul className="divide-y divide-border">
          {admins.map((a) => {
            const cfg = roleConfig[a.role];
            const Icon = cfg.icon;
            const initials = a.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
            return (
              <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {cfg.label}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Active {formatDistanceToNow(new Date(a.lastActive), { addSuffix: true })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)} disabled={a.role === "super_admin"}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add admin user</DialogTitle></DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={1}>
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@portal.com" type="email" /></div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                    <SelectItem value="verifier">Verifier</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
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


