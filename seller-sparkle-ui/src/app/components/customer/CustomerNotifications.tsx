import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck } from "lucide-react";
import { customerApi, type CustomerNotificationApi } from "@/app/services/customerApi";
import { customerNotificationTypeBadgeLabel } from "@/app/services/customerNotificationTypes";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/helpers/utils";
import { toast } from "sonner";

export const customerNotificationsQueryKey = ["customer-notifications"] as const;

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

const CustomerNotifications = () => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: customerNotificationsQueryKey,
    queryFn: () => customerApi.getNotifications(),
  });

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => customerApi.markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerNotificationsQueryKey });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Could not update notification.";
      toast.error(message);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => customerApi.markAllNotificationsRead(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: customerNotificationsQueryKey });
      if (res.updatedCount > 0) {
        toast.success(`Marked ${res.updatedCount} notification${res.updatedCount === 1 ? "" : "s"} as read.`);
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Could not mark all as read.";
      toast.error(message);
    },
  });

  const handleRowActivate = (n: CustomerNotificationApi) => {
    if (!n.readAt) {
      markReadMutation.mutate(n.id);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={unreadCount === 0 || markAllMutation.isPending || isLoading}
          onClick={() => markAllMutation.mutate()}
        >
          <CheckCheck className="h-4 w-4" />
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

      <Card className="overflow-hidden border-border/80 shadow-sm">
        {isLoading ? (
          <ul className="divide-y divide-border p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex gap-4">
                <Skeleton className="h-2 w-2 shrink-0 rounded-full mt-2" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-3 w-16 shrink-0" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.length === 0 ? (
              <li className="px-5 py-12 text-center text-sm text-muted-foreground">No notifications yet.</li>
            ) : (
              notifications.map((n) => {
                const unread = !n.readAt;
                const label = relativeTime(n.createdAt);
                const typeBadge = customerNotificationTypeBadgeLabel(n.notificationType);
                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40",
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
                      <div className="flex w-5 shrink-0 justify-center pt-1">
                        {unread ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-foreground" aria-hidden />
                        ) : (
                          <span className="block w-2" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold leading-snug">{n.title}</p>
                          {typeBadge ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {typeBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{n.body}</p>
                        {n.relatedOrderId ? (
                          <Link
                            to={`/customer/orders/${encodeURIComponent(n.relatedOrderId)}`}
                            className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            View order
                          </Link>
                        ) : null}
                      </div>
                      <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {label || "—"}
                      </time>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </Card>

      {isFetching && !isLoading ? (
        <p className="text-center text-xs text-muted-foreground">Updating…</p>
      ) : null}
    </div>
  );
};

export default CustomerNotifications;
