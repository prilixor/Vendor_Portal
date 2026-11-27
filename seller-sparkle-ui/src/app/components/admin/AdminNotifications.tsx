import { useState, useMemo, useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  adminApi,
  type AdminAlertFeedItem,
  type EquipmentEmergencyDto,
  type EquipmentEmergencyStatusFilter,
} from "@/app/services/adminApi";
import { ADMIN_EMERGENCIES_QUERY_KEY } from "@/app/components/admin/AdminEmergencyAlert";
import { chatApi } from "@/app/services/chatApi";
import { supportApi } from "@/app/services/supportApi";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Bell,
  AlertTriangle,
  Building,
  MessageSquare,
  ScrollText,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Package,
  Settings,
  RefreshCw,
  Clock,
  CheckCircle2,
  Siren,
} from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { Switch } from "@/app/components/ui/switch";

const EMERGENCY_PAGE_SIZE = 10;
/** How many live emergencies the "All Alerts" tab shows before pointing to the Equipment Emergency tab. */
const EMERGENCY_SUMMARY_SIZE = 5;

function mapFeedItemToAlert(item: AdminAlertFeedItem) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    status: item.status,
    timestamp: item.timestamp,
    meta: {
      listingTitle: item.listingTitle,
      customerName: item.customerName,
      vendorName: item.vendorName,
      amount: item.amount ?? 0,
      orderId: item.orderId,
      orderNumber: item.orderNumber,
      company: item.company,
      name: item.ownerName,
      email: item.email,
      kind: item.kind,
      notes: item.notes,
    },
    link: item.link,
  };
}

export const AdminNotifications = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabValues = ["all", "emergency", "orders", "vendors", "listings", "chats", "support", "logs"] as const;
  type AdminAlertTab = (typeof tabValues)[number];
  const initialTab = (searchParams.get("tab") as AdminAlertTab) ?? "all";
  const [activeTab, setActiveTab] = useState<AdminAlertTab>(
    tabValues.includes(initialTab) ? initialTab : "all"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as AdminAlertTab;
    if (t && tabValues.includes(t)) {
      setActiveTab(t);
    } else if (!t) {
      setActiveTab("all");
    }
  }, [searchParams]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const handleTabChange = (v: string) => {
    const val = v as AdminAlertTab;
    setActiveTab(val);
    setPage(1); // Reset pagination on tab change
    if (val === "all") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", val);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Chats, support and emergencies have their own lists; the alert feed just shows "all" behind them.
  const usesOwnList = activeTab === "chats" || activeTab === "support" || activeTab === "emergency";
  const feedTab = usesOwnList ? "all" : activeTab;
  const feedPage = usesOwnList ? 1 : page;

  const queryClient = useQueryClient();
  const [emergencyFilter, setEmergencyFilter] = useState<EquipmentEmergencyStatusFilter>("all");

  // Small summary: live emergencies for the "All Alerts" tab and the counts on the tab and filter chips.
  const { data: emergencySummary, refetch: refetchEmergencySummary } = useQuery({
    queryKey: [...ADMIN_EMERGENCIES_QUERY_KEY, "page", "summary"],
    queryFn: () => adminApi.getEquipmentEmergencyPage({ status: "live", page: 1, pageSize: EMERGENCY_SUMMARY_SIZE }, { quiet: true }),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });
  const emergencyOpenCount = emergencySummary?.openCount ?? 0;
  const emergencyAcknowledgedCount = emergencySummary?.acknowledgedCount ?? 0;
  const emergencyResolvedCount = emergencySummary?.resolvedCount ?? 0;
  const emergencyLiveCount = emergencyOpenCount + emergencyAcknowledgedCount;
  const emergencyTotalCount = emergencyLiveCount + emergencyResolvedCount;
  const liveEmergencies = emergencySummary?.items ?? [];

  // Full history, filtered and paged on the server. Only loaded while the Equipment Emergency tab is open.
  const {
    data: emergencyPageData,
    isError: emergenciesUnavailable,
    isLoading: isLoadingEmergencies,
    isPlaceholderData: isEmergencyPlaceholder,
    refetch: refetchEmergencyPage,
  } = useQuery({
    queryKey: [...ADMIN_EMERGENCIES_QUERY_KEY, "page", emergencyFilter, page],
    queryFn: () => adminApi.getEquipmentEmergencyPage({ status: emergencyFilter, page, pageSize: EMERGENCY_PAGE_SIZE }, { quiet: true }),
    enabled: activeTab === "emergency",
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
  });
  const emergencies = emergencyPageData?.items ?? [];
  const emergencyFilteredTotal = emergencyPageData?.totalCount ?? 0;
  const { data: emergencySettings } = useQuery({
    queryKey: ["admin-emergency-settings"],
    queryFn: () => adminApi.getEquipmentEmergencySettings(),
  });
  const saveVendorAlert = useMutation({
    mutationFn: (enabled: boolean) => adminApi.updateEquipmentEmergencySettings(enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-emergency-settings"] });
      toast.success("Emergency alert setting saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Could not save the setting."),
  });
  const acknowledgeEmergency = useMutation({
    mutationFn: (id: string) => adminApi.acknowledgeEquipmentEmergency(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_EMERGENCIES_QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message || "Could not acknowledge the emergency."),
  });
  const resolveEmergency = useMutation({
    mutationFn: (id: string) => adminApi.resolveEquipmentEmergency(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_EMERGENCIES_QUERY_KEY });
      toast.success("Emergency marked resolved. The customer has been told.");
    },
    onError: (err: Error) => toast.error(err.message || "Could not resolve the emergency."),
  });

  const { data: feed, isLoading: isLoadingFeed, refetch: refetchFeed, isPlaceholderData } = useQuery({
    queryKey: ["admin-alert-feed", feedTab, feedPage],
    queryFn: () => adminApi.getAdminAlertFeed({
      tab: feedTab,
      page: feedPage,
      pageSize: PAGE_SIZE,
    }, { quiet: true }),
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });
  const isFeedPageChanging = isPlaceholderData && !isLoadingFeed && !usesOwnList;

  const { data: continuationPage, isLoading: isLoadingContinuations, refetch: refetchContinuations } = useQuery({
    queryKey: ["admin-pending-continuation-summaries", 1, PAGE_SIZE],
    queryFn: () => adminApi.getAdminPendingContinuationSummaries({
      page: 1,
      pageSize: PAGE_SIZE,
    }, { quiet: true }),
    placeholderData: keepPreviousData,
    refetchInterval: 30000,
  });
  const pendingContinuations = continuationPage?.items ?? [];
  const pendingContinuationCount = continuationPage?.totalCount ?? 0;

  const chatListPage = activeTab === "chats" ? page : 1;
  const supportListPage = activeTab === "support" ? page : 1;

  const {
    data: chatPageData,
    isLoading: isLoadingChats,
    refetch: refetchChats,
    isPlaceholderData: isChatPlaceholder,
  } = useQuery({
    queryKey: ["admin-unread-chat-session-summaries", chatListPage, PAGE_SIZE],
    queryFn: () =>
      chatApi.getAdminSessionSummaries({
        unreadOnly: true,
        page: chatListPage,
        pageSize: PAGE_SIZE,
      }, { quiet: true }),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });
  const isChatPageChanging = isChatPlaceholder && !isLoadingChats && activeTab === "chats";
  const chatSessions = chatPageData?.items ?? [];
  const unreadChatCount = chatPageData?.totalCount ?? 0;

  const {
    data: supportPageData,
    isLoading: isLoadingSupport,
    refetch: refetchSupport,
    isPlaceholderData: isSupportPlaceholder,
  } = useQuery({
    queryKey: ["admin-unread-support-ticket-summaries", supportListPage, PAGE_SIZE],
    queryFn: () =>
      supportApi.getAdminTicketSummaries({
        unreadOnly: true,
        page: supportListPage,
        pageSize: PAGE_SIZE,
      }, { quiet: true }),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });
  const isSupportPageChanging = isSupportPlaceholder && !isLoadingSupport && activeTab === "support";
  const supportTickets = supportPageData?.items ?? [];
  const unreadSupportCount = supportPageData?.totalCount ?? 0;

  const isLoading =
    activeTab !== "emergency" && (isLoadingFeed
    || isLoadingContinuations
    || (activeTab === "chats" && isLoadingChats && !chatPageData)
    || (activeTab === "support" && isLoadingSupport && !supportPageData));
  const [manualRefresh, setManualRefresh] = useState(false);

  const handleRefreshAll = async () => {
    setManualRefresh(true);
    try {
      await Promise.all([
        refetchFeed(),
        refetchEmergencySummary(),
        activeTab === "emergency" ? refetchEmergencyPage() : Promise.resolve(),
        refetchContinuations(),
        refetchChats(),
        refetchSupport(),
      ]);
    } finally {
      setManualRefresh(false);
    }
  };

  const continuationAlerts = useMemo(() => {
    return pendingContinuations.flatMap((cont) => {
      if (cont.type === "extension") {
        return [{
          id: `ext-${cont.extensionId}`,
          type: "extension" as const,
          title: `Extension Requested: Order ${String(cont.orderNumber || "").split("-").slice(0, 3).join("-")}`,
          description: "Customer requested an extension. Requires admin review.",
          status: "pending_extension",
          timestamp: cont.createdOnUtc,
          meta: {
            listingTitle: cont.listingTitle,
            customerName: cont.customerName,
            vendorName: cont.vendorName,
            amount: cont.totalAmount,
            orderId: cont.orderId,
          },
          link: "/admin/orders",
        }];
      }
      if (cont.type === "buyout") {
        return [{
          id: `buy-${cont.extensionId}`,
          type: "buyout" as const,
          title: `Buyout Requested: Order ${String(cont.orderNumber || "").split("-").slice(0, 3).join("-")}`,
          description: "Customer requested to buyout the rented item. Requires admin review.",
          status: "pending_buyout",
          timestamp: cont.createdOnUtc,
          meta: {
            listingTitle: cont.listingTitle,
            customerName: cont.customerName,
            vendorName: cont.vendorName,
            amount: cont.totalAmount,
            orderId: cont.orderId,
          },
          link: "/admin/orders",
        }];
      }
      return [];
    });
  }, [pendingContinuations]);

  const feedAlerts = useMemo(
    () => (feed?.items ?? []).filter((item) => item.type !== "log").map(mapFeedItemToAlert),
    [feed],
  );

  const criticalOrders = useMemo(() => {
    const orders = feedAlerts.filter((a) => a.type === "order");
    const extras = page === 1 ? continuationAlerts : [];
    return [...orders, ...extras].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedAlerts, continuationAlerts, page]);

  const pendingVendors = useMemo(() => {
    return feedAlerts
      .filter((a) => a.type === "vendor")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedAlerts]);

  const listingAlerts = useMemo(() => {
    return feedAlerts
      .filter((a) => a.type === "listing")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [feedAlerts]);

  const sortedLogs = useMemo(() => {
    return (feed?.items ?? [])
      .filter((item) => item.type === "log")
      .map((item) => ({
        id: item.id,
        actionType: item.actionType || item.title,
        entityType: item.entityType || "system",
        adminId: item.adminId || "",
        adminName: item.adminName,
        adminEmail: item.adminEmail,
        oldValue: item.oldValue,
        newValue: item.newValue,
        createdAt: item.timestamp,
      }));
  }, [feed]);

  const chatAlerts = useMemo(() => {
    return chatSessions
      .map((s) => ({
        id: `chat-${s.id}`,
        type: "chat" as const,
        title: "Customer needs BlinksMed support",
        description:
          s.unreadCount === 1
            ? `${s.customerName} sent a new message${s.orderNumber ? ` on order ${s.orderNumber}` : ""}.`
            : `${s.customerName} has ${s.unreadCount} unread messages${s.orderNumber ? ` on order ${s.orderNumber}` : ""}.`,
        status: "unread",
        timestamp: s.lastMessageAt,
        meta: {
          customerName: s.customerName,
          orderNumber: s.orderNumber,
          unreadCount: s.unreadCount ?? 0,
          subject: s.subject,
        },
        link: `/admin/customer-chats?sessionId=${encodeURIComponent(s.id)}`,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [chatSessions]);

  const supportAlerts = useMemo(() => {
    return supportTickets
      .map((t) => {
        const vendorLabel = t.vendorBusinessName || t.vendorEmail || "Vendor";
        const unread = t.unreadCount ?? 0;
        const latest = t.latestMessage?.message?.trim();
        return {
          id: `support-${t.id}`,
          type: "support" as const,
          title: "Vendor needs BlinksMed support",
          description: latest
            ? `${vendorLabel} · ${t.ticketNumber}: "${latest.length > 80 ? `${latest.slice(0, 80)}…` : latest}"`
            : unread === 1
              ? `${vendorLabel} needs help on ${t.ticketNumber}.`
              : `${vendorLabel} has ${unread} unread messages on ${t.ticketNumber}.`,
          status: t.status,
          timestamp: t.updatedAt ?? t.createdAt,
          meta: {
            vendorEmail: t.vendorEmail,
            ticketNumber: t.ticketNumber,
            unreadCount: unread,
            subject: t.subject,
          },
          link: `/admin/support?ticketId=${encodeURIComponent(t.id)}`,
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [supportTickets]);

  const allAlerts = useMemo(() => {
    const extras = page === 1 ? [...chatAlerts, ...supportAlerts] : [];
    const list = [...criticalOrders, ...pendingVendors, ...listingAlerts, ...extras];
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [criticalOrders, pendingVendors, listingAlerts, chatAlerts, supportAlerts, page]);

  const counts = useMemo(() => ({
    all: (feed?.counts.all ?? 0) + pendingContinuationCount + unreadChatCount + unreadSupportCount,
    orders: (feed?.counts.orders ?? 0) + pendingContinuationCount,
    vendors: feed?.counts.vendors ?? 0,
    listings: feed?.counts.listings ?? 0,
    chats: unreadChatCount,
    support: unreadSupportCount,
    logs: feed?.counts.logs ?? 0,
  }), [feed, pendingContinuationCount, unreadChatCount, unreadSupportCount]);

  // Helper to format audit log timeline icons
  const getLogIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("approve") || a.includes("verify") || a.includes("active")) {
      return <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />;
    }
    if (a.includes("reject") || a.includes("ban") || a.includes("suspend") || a.includes("failed")) {
      return <ShieldAlert className="h-4 w-4 text-destructive" />;
    }
    if (a.includes("catalog") || a.includes("product") || a.includes("category") || a.includes("listing")) {
      return <Package className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />;
    }
    return <Settings className="h-4 w-4 text-muted-foreground" />;
  };

  const getLogColor = (value: string | null): string => {
    if (!value) return "bg-muted text-muted-foreground";
    const v = value.toLowerCase().trim();
    if (v.includes("approved") || v.includes("active") || v.includes("verified") || v.includes("completed") || v.includes("success")) {
      return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 border-emerald-500/20";
    }
    if (v.includes("rejected") || v.includes("banned") || v.includes("failed") || v.includes("deleted")) {
      return "bg-destructive/15 text-destructive border-destructive/20";
    }
    if (v.includes("suspended") || v.includes("under review") || v.includes("warning")) {
      return "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 border-amber-500/20";
    }
    return "bg-muted text-muted-foreground border-border/40";
  };

  const renderPagination = (totalItems: number) => (
    <TablePagination
      page={page}
      pageSize={PAGE_SIZE}
      total={totalItems}
      onPageChange={setPage}
      label="items"
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Notifications Center"
        description="Consolidated monitoring, critical order alarms, pending onboarding verifications, and real-time activity stream."
        actions={
          <Button variant="outline" size="sm" onClick={() => void handleRefreshAll()} disabled={manualRefresh || isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", manualRefresh && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full flex-nowrap overflow-x-auto justify-start bg-muted/40 p-1 mb-6">
          <TabsTrigger value="all" className="text-xs">
            All Alerts ({counts.all + emergencyLiveCount})
          </TabsTrigger>
          <TabsTrigger value="emergency" className="gap-1.5 text-xs">
            <Siren className={cn("h-3.5 w-3.5", emergencyOpenCount > 0 && "text-red-600")} />
            Equipment Emergency
            {emergencyOpenCount > 0 ? (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {emergencyOpenCount}
              </span>
            ) : (
              <span>({emergencyLiveCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs">
            Order Alerts ({counts.orders})
          </TabsTrigger>
          <TabsTrigger value="vendors" className="text-xs">
            Pending Onboarding ({counts.vendors})
          </TabsTrigger>
          <TabsTrigger value="listings" className="text-xs">
            Listing Pricing ({counts.listings})
          </TabsTrigger>
          <TabsTrigger value="chats" className="text-xs">
            Customer Chats ({counts.chats})
          </TabsTrigger>
          <TabsTrigger value="support" className="text-xs">
            Vendor Support ({counts.support})
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">
            System Activity Stream ({counts.logs})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PageContentGate loading={isLoading}>
        <div className={cn("space-y-4 transition-opacity duration-200", (isFeedPageChanging || isChatPageChanging || isSupportPageChanging) && "opacity-50")}>
          {/* TAB: ALL ALERTS */}
          {activeTab === "all" && page === 1 && liveEmergencies.length > 0 && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/40 p-3 dark:border-red-900 dark:bg-red-950/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Siren className="h-4 w-4 text-red-600" />
                  Equipment emergencies needing attention ({emergencyLiveCount})
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTabChange("emergency")}>
                  View all emergencies
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
              {liveEmergencies.map((item) => (
                <EmergencyRow
                  key={item.id}
                  item={item}
                  busy={acknowledgeEmergency.isPending || resolveEmergency.isPending}
                  onAcknowledge={() => acknowledgeEmergency.mutate(item.id)}
                  onResolve={() => resolveEmergency.mutate(item.id)}
                  onOpen={() => navigate(`/admin/orders/${item.orderId}`)}
                />
              ))}
              {emergencyLiveCount > liveEmergencies.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the latest {liveEmergencies.length}. Open the Equipment Emergency tab to see the rest.
                </p>
              )}
            </div>
          )}
          {activeTab === "all" && (
            counts.all === 0 ? (
              emergencyLiveCount > 0 ? null :
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">All Clear!</h3>
                <p className="mt-1 text-sm text-muted-foreground">No urgent dispatch failures, onboarding requests, or listing pricing alerts.</p>
              </Card>
            ) : (
              <div>
                {allAlerts.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(counts.all)}
              </div>
            )
          )}

          {/* TAB: DISPATCH FAILURES */}
          {activeTab === "orders" && (
            counts.orders === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No order alerts</h3>
                <p className="mt-1 text-sm text-muted-foreground">No dispatch failures or refunds are waiting for you.</p>
              </Card>
            ) : (
              <div>
                {criticalOrders.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(counts.orders)}
              </div>
            )
          )}

          {/* TAB: PENDING VENDORS */}
          {activeTab === "vendors" && (
            counts.vendors === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Onboarding Approvals Pending</h3>
                <p className="mt-1 text-sm text-muted-foreground">All registered vendors have been fully processed and verified.</p>
              </Card>
            ) : (
              <div>
                {pendingVendors.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(counts.vendors)}
              </div>
            )
          )}

          {/* TAB: LISTING PRICING */}
          {activeTab === "listings" && (
            counts.listings === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Listing Pricing Alerts</h3>
                <p className="mt-1 text-sm text-muted-foreground">No recent vendor product or chemical listing create/update events requiring pricing review.</p>
              </Card>
            ) : (
              <div>
                {listingAlerts.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(counts.listings)}
              </div>
            )
          )}

          {/* TAB: EQUIPMENT EMERGENCY */}
          {activeTab === "emergency" && (
            <Card className="border-border/80">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Siren className="h-4 w-4 text-red-600" />
                      Equipment emergencies
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Raised by customers on rented or bought equipment. Admin always gets the popup and the bell.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <Switch
                      id="alert-vendor-emergency"
                      checked={emergencySettings?.alertVendorEnabled ?? false}
                      disabled={saveVendorAlert.isPending || !emergencySettings}
                      onCheckedChange={(checked) => saveVendorAlert.mutate(checked)}
                    />
                    <label htmlFor="alert-vendor-emergency" className="text-sm">Also alert the vendor</label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Emergency status">
                  {(
                    [
                      { value: "all", label: "All", count: emergencyTotalCount },
                      { value: "open", label: "Waiting", count: emergencyOpenCount },
                      { value: "acknowledged", label: "Acknowledged", count: emergencyAcknowledgedCount },
                      { value: "resolved", label: "Resolved", count: emergencyResolvedCount },
                    ] as { value: EquipmentEmergencyStatusFilter; label: string; count: number }[]
                  ).map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      role="tab"
                      aria-selected={emergencyFilter === chip.value}
                      onClick={() => {
                        setEmergencyFilter(chip.value);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        emergencyFilter === chip.value
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {chip.label} ({chip.count})
                    </button>
                  ))}
                </div>

                {emergenciesUnavailable ? (
                  <p className="text-sm text-destructive">Emergency list is unavailable. Apply the equipment emergency database scripts, then refresh.</p>
                ) : isLoadingEmergencies ? (
                  <p className="text-sm text-muted-foreground">Loading emergencies…</p>
                ) : emergencies.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                    <p className="mt-2 text-sm font-medium">
                      {emergencyFilter === "all" ? "No equipment emergencies yet." : "Nothing in this status."}
                    </p>
                  </div>
                ) : (
                  <div className={cn("space-y-2 transition-opacity", isEmergencyPlaceholder && "opacity-50")}>
                    {emergencies.map((item) => (
                      <EmergencyRow
                        key={item.id}
                        item={item}
                        busy={acknowledgeEmergency.isPending || resolveEmergency.isPending}
                        onAcknowledge={() => acknowledgeEmergency.mutate(item.id)}
                        onResolve={() => resolveEmergency.mutate(item.id)}
                        onOpen={() => navigate(`/admin/orders/${item.orderId}`)}
                      />
                    ))}
                  </div>
                )}

                <TablePagination
                  page={page}
                  pageSize={EMERGENCY_PAGE_SIZE}
                  total={emergencyFilteredTotal}
                  onPageChange={setPage}
                  label="emergencies"
                  hideWhenSinglePage
                />
              </CardContent>
            </Card>
          )}

          {/* TAB: CUSTOMER CHATS */}
          {activeTab === "chats" && (
            unreadChatCount === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Unread Customer Chats</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You&apos;re caught up. New messages from customers appear here until you open the conversation.
                </p>
              </Card>
            ) : (
              <div>
                {chatAlerts.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(unreadChatCount)}
              </div>
            )
          )}

          {/* TAB: VENDOR SUPPORT */}
          {activeTab === "support" && (
            unreadSupportCount === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Unread Vendor Support</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You&apos;re caught up. Bot escalations and vendor follow-ups appear here until you open the ticket.
                </p>
              </Card>
            ) : (
              <div>
                {supportAlerts.map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(unreadSupportCount)}
              </div>
            )
          )}

          {/* TAB: SYSTEM ACTIVITY STREAM */}
          {activeTab === "logs" && (
            counts.logs === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <p className="text-sm text-muted-foreground">No recent system activity logs recorded.</p>
              </Card>
            ) : (
              <Card className="border-border/60 p-6 sm:p-8">
                <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" /> Live Audit Log Feed
                </h3>
                <div className="relative border-l border-border pl-6 ml-3 mt-2 space-y-6">
                  {sortedLogs.map((log) => (
                    <div key={log.id} className="relative group hover:bg-accent/10 p-3 rounded-lg border border-transparent hover:border-border/40 transition-colors">
                      {/* Left icon marker */}
                      <span className="absolute -left-[37px] top-4 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-all group-hover:scale-105">
                        {getLogIcon(log.actionType)}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {log.entityType}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-semibold bg-primary-soft text-primary">
                              {log.actionType}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {log.adminName || log.adminEmail || `Admin ID: ${log.adminId.slice(0, 8)}...`}
                          </p>
                          {/* Value changes */}
                          <div className="inline-flex items-center gap-2 text-xs pt-1">
                            {log.oldValue && (
                              <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", getLogColor(log.oldValue))}>
                                {log.oldValue}
                              </span>
                            )}
                            {log.oldValue && log.newValue && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                            {log.newValue && (
                              <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", getLogColor(log.newValue))}>
                                {log.newValue}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 sm:text-right">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {renderPagination(counts.logs)}
              </Card>
            )
          )}
        </div>
      </PageContentGate>
    </div>
  );
};

// Sub-component for Alerts mapping
const AlertCard = ({
  alert,
  navigate,
}: {
  alert: {
    id: string;
    type: "order" | "vendor" | "extension" | "buyout" | "listing" | "chat" | "support";
    title: string;
    description: string;
    status: string;
    timestamp: string;
    meta: any;
    link: string;
  };
  navigate: (path: string) => void;
}) => {
  const isDepositRefund = alert.id.startsWith("deposit-refund-") || alert.title.startsWith("Deposit refund due");
  const isCancellationRefund = alert.id.startsWith("cancellation-refund-") || alert.title.startsWith("Cancellation refund due");
  const isRefund = isDepositRefund || isCancellationRefund;
  const statusLabel = isDepositRefund
    ? "Refund due"
    : isCancellationRefund
      ? "Review refund"
      : alert.status.replaceAll("_", " ").toUpperCase();
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border/100 hover:shadow-md sm:p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className={cn(
          "rounded-lg p-2.5 shrink-0 mt-0.5",
          isRefund ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
          : alert.type === "order" ? "bg-destructive/10 text-destructive" 
          : alert.type === "extension" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
          : alert.type === "buyout" ? "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
          : alert.type === "listing" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          : alert.type === "chat" || alert.type === "support" ? "bg-primary/10 text-primary"
          : "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        )}>
          {isRefund ? <RefreshCw className="h-5 w-5" />
           : alert.type === "order" ? <AlertTriangle className="h-5 w-5" /> 
           : alert.type === "extension" ? <Clock className="h-5 w-5" />
           : alert.type === "buyout" || alert.type === "listing" ? <Package className="h-5 w-5" />
           : alert.type === "chat" || alert.type === "support" ? <MessageSquare className="h-5 w-5" />
           : <Building className="h-5 w-5" />}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-bold text-foreground">{alert.title}</h4>
            <Badge variant="outline" className={cn(
              "text-[10px] font-semibold uppercase tracking-wider py-0 px-2",
              isRefund
                ? "bg-amber-100 text-amber-950 border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/30"
                : alert.type === "order"
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : alert.type === "extension"
                ? "bg-blue-100 text-blue-800 border-blue-500/20 dark:bg-blue-900/30 dark:text-blue-300"
                : alert.type === "buyout"
                ? "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-500/20 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
                : alert.type === "listing"
                ? "bg-indigo-100 text-indigo-800 border-indigo-500/20 dark:bg-indigo-900/30 dark:text-indigo-300"
                : alert.type === "chat" || alert.type === "support"
                ? "bg-primary/15 text-primary border-primary/20"
                : "bg-amber-100 text-amber-950 border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/30"
            )}>
              {statusLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{alert.description}</p>
          
          {/* Metadata chips */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground pt-1.5">
            {alert.type === "order" || alert.type === "extension" || alert.type === "buyout" ? (
              <>
                {alert.meta.listingTitle ? (
                  <p>Listing: <span className="text-foreground">{alert.meta.listingTitle}</span></p>
                ) : null}
                {alert.meta.orderNumber ? (
                  <p>Order: <span className="text-foreground font-mono">{alert.meta.orderNumber}</span></p>
                ) : null}
                <p>Customer: <span className="text-foreground">{alert.meta.customerName}</span></p>
                <p>{isRefund ? "Amount" : "Total Amount"}: <span className="text-primary font-bold">₹{alert.meta.amount.toFixed(0)}</span></p>
              </>
            ) : alert.type === "listing" ? (
              <>
                <p>Listing: <span className="text-foreground">{alert.meta.listingTitle}</span></p>
                <p>Catalog: <span className="text-foreground capitalize">{alert.meta.kind || "product"}</span></p>
              </>
            ) : alert.type === "chat" ? (
              <>
                <p>Customer: <span className="text-foreground">{alert.meta.customerName}</span></p>
                {alert.meta.orderNumber ? (
                  <p>Order: <span className="text-foreground font-mono">{alert.meta.orderNumber}</span></p>
                ) : null}
                <p>Unread: <span className="text-foreground font-bold">{alert.meta.unreadCount}</span></p>
              </>
            ) : alert.type === "support" ? (
              <>
                <p>Ticket: <span className="text-foreground font-mono">{alert.meta.ticketNumber}</span></p>
                {alert.meta.vendorEmail ? (
                  <p className="flex items-center gap-1 flex-wrap">
                    Vendor: <CopyableEmail email={alert.meta.vendorEmail} textClassName="text-foreground" />
                  </p>
                ) : null}
                <p>Unread: <span className="text-foreground font-bold">{alert.meta.unreadCount}</span></p>
              </>
            ) : (
              <>
                <p>Company: <span className="text-foreground">{alert.meta.company || "Not provided"}</span></p>
                <p>Owner: <span className="text-foreground">{alert.meta.name}</span></p>
                <p className="flex items-center gap-1 flex-wrap">
                  Email:{" "}
                  {alert.meta.email ? (
                    <CopyableEmail email={alert.meta.email} textClassName="text-foreground" />
                  ) : (
                    <span className="text-foreground">—</span>
                  )}
                </p>
              </>
            )}
            <p className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" /> {new Date(alert.timestamp).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end shrink-0 pt-3 md:pt-0 border-t border-border/20 md:border-none">
        <Button size="sm" className="w-full md:w-auto h-9 font-semibold text-xs bg-foreground text-background hover:bg-foreground/90 transition-colors" onClick={() => {
          if (alert.type === "extension" || alert.type === "buyout") {
            navigate(alert.link, { state: { openOrderId: alert.meta.orderId } });
          } else {
            navigate(alert.link);
          }
        }}>
          {isRefund
            ? "Open refund"
            : alert.type === "listing"
            ? "Open Catalog"
            : alert.type === "chat" || alert.type === "support"
              ? "Open Chat"
              : "Resolve Action"}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

function EmergencyRow({
  item,
  busy,
  onAcknowledge,
  onResolve,
  onOpen,
}: {
  item: EquipmentEmergencyDto;
  busy: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  onOpen: () => void;
}) {
  const open = item.status === "open";
  const acknowledged = item.status === "acknowledged";
  const raised = new Date(item.createdAt);
  const raisedLabel = Number.isNaN(raised.getTime())
    ? ""
    : raised.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const statusLabel = open ? "Waiting" : acknowledged ? "Acknowledged" : "Resolved";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-sm",
        open && "border-l-4 border-l-red-500",
        acknowledged && "border-l-4 border-l-amber-500",
        !open && !acknowledged && "border-l-4 border-l-emerald-500/70",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{item.productName}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                open && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
                acknowledged && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
                !open && !acknowledged && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
              )}
            >
              {statusLabel}
            </span>
            {item.vendorNotified && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Vendor alerted</span>
            )}
          </div>
          <p className="font-medium">{item.reasonLabel}</p>
          {item.note && <p className="line-clamp-2 break-words text-muted-foreground" title={item.note}>{item.note}</p>}
          <p className="text-xs text-muted-foreground">
            {item.customerName}
            {item.customerPhone ? ` · ${item.customerPhone}` : ""} · Order {item.orderNumber}
            {raisedLabel ? ` · ${raisedLabel}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {open && (
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={onAcknowledge}>
              Acknowledge
            </Button>
          )}
          {(open || acknowledged) && (
            <Button type="button" size="sm" variant={open ? "outline" : "default"} disabled={busy} onClick={onResolve}>
              Resolve
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onOpen}>
            Open order
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdminNotifications;
