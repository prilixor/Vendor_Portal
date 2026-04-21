import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { Save } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, security, and preferences." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 p-6">
          <h2 className="mb-4 font-semibold">Account</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Full name</Label><Input defaultValue={user?.name} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input defaultValue={user?.email} type="email" /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input defaultValue="+91 98765 43210" /></div>
            <div className="space-y-1.5"><Label>Time zone</Label><Input defaultValue="Asia/Kolkata (GMT+5:30)" /></div>
          </div>
          <Button className="mt-5 bg-gradient-primary shadow-glow" onClick={() => toast.success("Profile saved")}>
            <Save className="mr-2 h-4 w-4" /> Save changes
          </Button>
        </Card>
        <Card className="border-border/60 p-6">
          <h2 className="mb-4 font-semibold">Security</h2>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Current password</Label><Input type="password" /></div>
            <div className="space-y-1.5"><Label>New password</Label><Input type="password" /></div>
            <Button variant="outline" className="w-full" onClick={() => toast.success("Password updated")}>Update password</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;


