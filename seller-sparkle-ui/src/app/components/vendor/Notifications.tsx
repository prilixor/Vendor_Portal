import { useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { mockNotifications } from "@/app/services/mockData";
import { Notification } from "@/app/models";
import { CheckCheck, Bell, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeIcons = {
  info: { icon: Info, cls: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  error: { icon: XCircle, cls: "bg-destructive-soft text-destructive" },
};

const Notifications = () => {
  const [items, setItems] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [prefs, setPrefs] = useState({ email: true, push: true, orders: true });

  const filtered = filter === "unread" ? items.filter((i) => !i.read) : items;
  const markAll = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));
  const toggleRead = (id: string) => setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated with rental requests, document reviews, and stock alerts."
        actions={
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="font-semibold">Inbox</h2>
            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((n) => {
              const { icon: Icon, cls } = typeIcons[n.type];
              return (
                <li
                  key={n.id}
                  className={`flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-muted/30 ${!n.read ? "bg-primary-soft/30" : ""}`}
                  onClick={() => toggleRead(n.id)}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{n.title}</p>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-semibold">You're all caught up</p>
                <p className="text-xs text-muted-foreground">No unread notifications.</p>
              </li>
            )}
          </ul>
        </Card>

        <Card className="border-border/60 p-5 h-fit">
          <h2 className="mb-4 font-semibold">Preferences</h2>
          <div className="space-y-3">
            {[
              { key: "email" as const, label: "Email notifications", desc: "Receive updates in your inbox" },
              { key: "push" as const, label: "Push notifications", desc: "Browser push alerts" },
              { key: "orders" as const, label: "Order alerts", desc: "Real-time rental requests" },
            ].map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <Switch checked={prefs[p.key]} onCheckedChange={(v) => setPrefs((s) => ({ ...s, [p.key]: v }))} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;


