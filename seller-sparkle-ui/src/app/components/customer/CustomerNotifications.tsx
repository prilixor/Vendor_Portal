import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck } from "lucide-react";
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
                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex w-full min-w-0 gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:gap-4 sm:px-5 sm:py-3.5",
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
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          unread ? "bg-primary" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug sm:text-base">{n.title}</p>
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
