import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCheck,
  Bell,
  Camera,
  ShoppingBag,
  Truck,
  CreditCard,
  Hourglass,
  XCircle,
  MessageSquare,
  Package,
  Hand,
  LucideIcon,
} from "lucide-react";
import { customerApi, type CustomerNotificationApi } from "@/app/services/customerApi";
import {
  customerNotificationTypeBadgeClass,
  customerNotificationTypeBadgeLabel,
} from "@/app/services/customerNotificationTypes";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ListPager } from "@/app/components/shared/ListPager";
import { cn } from "@/app/helpers/utils";
import { toast } from "sonner";

export const customerNotificationsQueryKey = ["customer-notifications"] as const;

interface CustomerNotificationVisual {
  icon: LucideIcon;
  cls: string;
}

function getCustomerNotificationVisual(notificationType?: string, title: string = ""): CustomerNotificationVisual {
  const t = (notificationType ?? "").trim().toLowerCase();
  const h = title.trim().toLowerCase();

  // Welcome / Onboarding
  if (t.includes("welcome") || h.includes("welcome")) {
    return { icon: Hand, cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" };
  }

  // Photo requests (inspection photos)
  if (t.includes("photo") || h.includes("photo")) {
    return { icon: Camera, cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" };
  }

  // Delivery / Transit / Shipping
  if (
    t.includes("dispatch") ||
    t.includes("transit") ||
    t.includes("delivery") ||
    t.includes("shipping") ||
    h.includes("dispatch") ||
    h.includes("delivery") ||
    h.includes("transit")
  ) {
    return { icon: Truck, cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" };
  }

  // Payments / Renewals
  if (t.includes("payment") || t.includes("pay") || t.includes("invoice") || t.includes("refund") || h.includes("payment")) {
    return { icon: CreditCard, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" };
  }

  // Expirations / Extensions
  if (t.includes("expir") || t.includes("return") || t.includes("continuation") || h.includes("expir") || h.includes("return")) {
    return { icon: Hourglass, cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
  }

  // Cancellations / Failures
  if (t.includes("cancel") || t.includes("fail") || t.includes("reject") || h.includes("cancel") || h.includes("failed")) {
    return { icon: XCircle, cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" };
  }

  // Support / Chat replies
  if (t.includes("support") || t.includes("chat") || h.includes("support") || h.includes("ticket")) {
    return { icon: MessageSquare, cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" };
  }

  // Stock / Wishlist
  if (t.includes("stock") || h.includes("stock") || h.includes("favorite")) {
    return { icon: Package, cls: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300" };
  }

  // Orders
  if (t.includes("order") || h.includes("order") || h.includes("rental")) {
    return { icon: ShoppingBag, cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" };
  }

  return { icon: Bell, cls: "bg-primary/10 text-primary" };
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

const getCustomerRoute = (notificationType?: string, title?: string): string | null => {
  const type = notificationType?.trim().toLowerCase() ?? "";
  
  if (type === "support_chat_reply" || type.includes("support_chat") || type.includes("blinksmed")) {
    return "/customer/orders";
  }
  if (type.startsWith("order_") || type.includes("order") || type === "order_expiring_soon") {
    return "/customer/orders";
  }
  if (type === "welcome" || type === "general") {
    return "/customer/shop";
  }
  
  // Fallback to title matching
  const t = title?.toLowerCase() ?? "";
  if (t.includes("support") || t.includes("blinksmed") || t.includes("replied")) {
    return "/customer/orders";
  }
  if (t.includes("order") || t.includes("rental") || t.includes("placed") || t.includes("expired") || t.includes("expiring")) {
    return "/customer/orders";
  }
  if (t.includes("welcome") || t.includes("dashboard")) {
    return "/customer/shop";
  }
  
  return null;
};

const CustomerNotifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: customerNotificationsQueryKey,
    queryFn: () => customerApi.getNotifications({ quiet: true }),
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => customerApi.markNotificationRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: customerNotificationsQueryKey });
      const previous = queryClient.getQueryData<CustomerNotificationApi[]>(customerNotificationsQueryKey);
      const readAt = new Date().toISOString();
      queryClient.setQueryData<CustomerNotificationApi[]>(customerNotificationsQueryKey, (current) =>
        (current ?? []).map((n) => (n.id === notificationId && !n.readAt ? { ...n, readAt } : n)),
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(customerNotificationsQueryKey, context.previous);
      }
      const message = err instanceof Error ? err.message : "Could not update notification.";
      toast.error(message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: customerNotificationsQueryKey });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => customerApi.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: customerNotificationsQueryKey });
      const previous = queryClient.getQueryData<CustomerNotificationApi[]>(customerNotificationsQueryKey);
      const readAt = new Date().toISOString();
      queryClient.setQueryData<CustomerNotificationApi[]>(customerNotificationsQueryKey, (current) =>
        (current ?? []).map((n) => (n.readAt ? n : { ...n, readAt })),
      );
      return { previous };
    },
    onSuccess: (res) => {
      if (res.updatedCount > 0) {
        toast.success(`Marked ${res.updatedCount} notification${res.updatedCount === 1 ? "" : "s"} as read.`);
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(customerNotificationsQueryKey, context.previous);
      }
      const message = err instanceof Error ? err.message : "Could not mark all as read.";
      toast.error(message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: customerNotificationsQueryKey });
    },
  });

  const handleRowActivate = async (n: CustomerNotificationApi) => {
    if (!n.readAt) {
      try {
        await markReadMutation.mutateAsync(n.id);
      } catch (e) {
        console.error(e);
      }
    }
    if (n.relatedOrderId) {
      navigate(`/customer/orders/${encodeURIComponent(n.relatedOrderId)}`);
    } else {
      const isBackInStock = n.title.toLowerCase().includes("stock") || n.notificationType === "back_in_stock";
      if (isBackInStock) {
        const match = n.body.match(/Good news! (.*?) from your favorites/);
        if (match && match[1]) {
           try {
             const results = await customerApi.getCatalogListings(undefined, match[1]);
             if (results && results.length > 0) {
               navigate(`/customer/shop/${encodeURIComponent(results[0].id)}`);
               return;
             }
           } catch (e) {
             console.error(e);
           }
        }
        navigate("/customer/shop");
        return;
      }

      const route = getCustomerRoute(n.notificationType, n.title);
      if (route) {
        navigate(route);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
          disabled={unreadCount === 0 || markAllMutation.isPending || isLoading}
          onClick={() => markAllMutation.mutate()}
        >
          <CheckCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Mark all read
        </Button>
      </div>

      {isError ? (
        <Card className="border-destructive/40 p-6 shadow-sm">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load notifications."}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </Card>
      ) : null}

      <Card className="-mx-3 overflow-hidden rounded-none border-x-0 border-border/80 shadow-sm sm:mx-0 sm:rounded-lg sm:border">
        {isLoading ? (
          <PageLoaderSlot className="min-h-[8rem] py-0" />
        ) : (
          <ul className="divide-y divide-border">
            {sortedNotifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5 sm:py-12">No notifications yet.</li>
            ) : (
              sortedNotifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((n) => {
                const unread = !n.readAt;
                const label = relativeTime(n.createdAt);
                const typeBadge = customerNotificationTypeBadgeLabel(n.notificationType);
                const { icon: VisualIcon, cls: visualCls } = getCustomerNotificationVisual(
                  n.notificationType,
                  n.title,
                );
                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex w-full min-w-0 items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:gap-4 sm:px-5 sm:py-3.5",
                        unread && "bg-muted/20",
                      )}
                      onClick={() => handleRowActivate(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleRowActivate(n);
                        }
                      }}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${visualCls}`}>
                        <VisualIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug sm:text-base">{n.title}</p>
                          {unread && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                          )}
                          {typeBadge ? (
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 sm:hidden",
                                customerNotificationTypeBadgeClass(n.notificationType),
                              )}
                            >
                              {typeBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-normal">{n.body}</p>
                        <div className="flex items-center justify-between gap-2 sm:justify-start">
                          {n.relatedOrderId ? (
                            <Link
                              to={`/customer/orders/${encodeURIComponent(n.relatedOrderId)}`}
                              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              View order
                            </Link>
                          ) : null}
                          <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground sm:hidden">
                            {label || "—"}
                          </time>
                        </div>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        {typeBadge ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4",
                              customerNotificationTypeBadgeClass(n.notificationType),
                            )}
                          >
                            {typeBadge}
                          </span>
                        ) : null}
                        <time className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                          {label || "—"}
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </Card>

      {sortedNotifications.length > PAGE_SIZE && (
        <ListPager
          page={page}
          totalPages={Math.max(1, Math.ceil(sortedNotifications.length / PAGE_SIZE))}
          summary={`Page ${page} of ${Math.max(1, Math.ceil(sortedNotifications.length / PAGE_SIZE))} · ${sortedNotifications.length} items`}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default CustomerNotifications;
