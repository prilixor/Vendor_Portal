import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ListPager } from "@/app/components/shared/ListPager";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Notification } from "@/app/models";
import { CheckCheck, Bell, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { useNotificationContext } from "@/app/contexts/NotificationContext";
import { AdminCommentHint } from "@/app/components/shared/AdminCommentHint";
import {
  extractAdminCommentFromNotification,
  isVerificationRejectionNotification,
  notificationDisplayMessage,
} from "@/app/helpers/adminComment";
import { getVendorRoute, VENDOR_SUPPORT_PANEL_ROUTE } from "@/app/helpers/vendorNav";
import { useSupportChat } from "@/app/contexts/SupportChatContext";

const typeIcons = {
  info: { icon: Info, cls: "bg-info-soft text-info" },
  success: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  error: { icon: XCircle, cls: "bg-destructive-soft text-destructive" },
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotificationContext();
  const { openSupportPanel } = useSupportChat();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [prefs, setPrefs] = useState({ email: true, push: false, orders: true });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = useMemo(
    () => {
      const result = filter === "unread" ? items.filter((i) => !i.read) : [...items];
      return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },
    [filter, items]
  );

  const mapType = (type: string): Notification["type"] => {
    const t = type.trim().toLowerCase();
    if (t === "success" || t === "warning" || t === "error" || t === "info") return t;
    if (t.includes("approved") || t.includes("payout")) return "success";
    if (t.includes("rejected") || t.includes("failed")) return "error";
    if (t.includes("stock") || t.includes("warning")) return "warning";
    return "info";
  };

  const mapNotifications = (rows: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorNotifications>>): Notification[] =>
    rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: mapType(n.notificationType),
      read: n.status.trim().toLowerCase() === "read" || !!n.readAt,
      timestamp: n.sentAt ?? n.readAt ?? new Date().toISOString(),
      notificationType: n.notificationType,
    }));

  const loadNotificationData = async () => {
    if (!user) return;
    setBusy(true);
    setLoadError(null);
    try {
      const [prefRes, notifRes] = await Promise.allSettled([
        vendorOnboardingApi.getVendorNotificationPreference(user.id),
        vendorOnboardingApi.getVendorNotifications(user.id),
      ]);

      if (prefRes.status === "fulfilled") {
        setPrefs({
          email: prefRes.value.emailNotificationsEnabled,
          push: prefRes.value.pushNotificationsEnabled,
          orders: prefRes.value.newOrderNotifications,
        });
      }

      if (notifRes.status === "fulfilled") {
        setItems(mapNotifications(notifRes.value));
      } else {
        const message = notifRes.reason instanceof Error ? notifRes.reason.message : "Failed to load notifications.";
        setLoadError(message);
        toast.error(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load notifications.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setBusy(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    void loadNotificationData();
  }, [user]);

  // Refresh notifications when window gains focus (user returns to the tab)
  useEffect(() => {
    const handleFocus = () => {
      void loadNotificationData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  const { isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  const updatePreference = async (next: typeof prefs) => {
    if (!user) return;
    setPrefs(next);
    try {
      await vendorOnboardingApi.upsertVendorNotificationPreference(user.id, {
        vendorId: user.id,
        emailNotificationsEnabled: next.email,
        pushNotificationsEnabled: next.push,
        newOrderNotifications: next.orders,
      });

      // Handle push subscription when toggle changes
      if (next.push && !isSubscribed) {
        await subscribe();
      } else if (!next.push && isSubscribed) {
        await unsubscribe();
      }

      toast.success("Preferences saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save preferences.";
      toast.error(message);
      await loadNotificationData();
    }
  };

  const markAll = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await vendorOnboardingApi.markAllVendorNotificationsAsRead(user.id);
      if (res.updatedCount > 0) {
        setItems((arr) => arr.map((n) => ({ ...n, read: true })));
        toast.success(`Marked ${res.updatedCount} notification(s) as read.`);
        await refreshUnreadCount();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark all notifications as read.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRead = async (id: string) => {
    if (!user) return;
    const target = items.find((n) => n.id === id);
    if (!target) return;

    try {
      if (target.read) {
        await vendorOnboardingApi.markVendorNotificationAsUnread(user.id, id);
        setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read: false } : n)));
      } else {
        await vendorOnboardingApi.markVendorNotificationAsRead(user.id, id);
        setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read: true } : n)));
      }
      await refreshUnreadCount();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to toggle notification status.";
      toast.error(message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated with rental requests, document reviews, and stock alerts."
        actions={
          <Button variant="outline" onClick={markAll} disabled={busy}>
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        }
      />

      {!hasLoaded && busy && <PageLoaderSlot />}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      {hasLoaded && !busy && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-semibold">Inbox</h2>
            <Tabs value={filter} onValueChange={(v: string) => { setFilter(v as "all" | "unread"); setPage(1); }}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ul className="divide-y divide-border">
            {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((n) => {
              const { icon: Icon, cls } = typeIcons[n.type];
              const isRejection = isVerificationRejectionNotification(
                n.notificationType ?? "",
              );
              const adminComment = isRejection
                ? extractAdminCommentFromNotification(n.message)
                : null;
              const body = notificationDisplayMessage(
                n.message,
                n.notificationType ?? "",
              );
              return (
                <li
                  key={n.id}
                  className={`flex cursor-pointer flex-col items-stretch gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start ${!n.read ? "bg-primary-soft/30" : ""}`}
                  onClick={() => {
                    if (!n.read) {
                      void toggleRead(n.id);
                    }
                    let route = getVendorRoute(n.notificationType, n.title);

                    if (route === VENDOR_SUPPORT_PANEL_ROUTE) {
                      openSupportPanel();
                      return;
                    }
                    
                    // Try to extract order ID from message
                    const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
                    const match = n.message.match(uuidRegex);
                    
                    if (route === "/vendor/orders" && match) {
                      route = `/vendor/orders/${match[1]}`;
                    }

                    if (route) {
                      navigate(route);
                    }
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold break-words">{n.title}</p>
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        )}
                      </div>
                      {body && (
                        <p className="mt-0.5 text-sm text-muted-foreground break-words">{body}</p>
                      )}
                      {adminComment && (
                        <AdminCommentHint
                          className="mt-2"
                          comment={adminComment}
                        />
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 self-start px-2 text-xs sm:self-auto sm:text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleRead(n.id);
                    }}
                    disabled={busy}
                  >
                    Mark {n.read ? "unread" : "read"}
                  </Button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-semibold">You're all caught up</p>
                <p className="text-xs text-muted-foreground">
                  {filter === "unread" ? "No unread notifications." : "No notifications yet."}
                </p>
              </li>
            )}
          </ul>

          {filtered.length > PAGE_SIZE && (
            <ListPager
              className="border-t border-border/40 pt-6 mt-6"
              page={page}
              totalPages={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
              summary={`Page ${page} of ${Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} · ${filtered.length} items`}
              onPageChange={setPage}
            />
          )}
        </Card>

        <Card className="border-border/60 p-4 sm:p-6 lg:p-8 h-fit">
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
                <Switch
                  checked={prefs[p.key]}
                  onCheckedChange={(v) => void updatePreference({ ...prefs, [p.key]: v })}
                  disabled={busy}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
        </>
      )}
    </div>
  );
};

export default Notifications;


