import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminApi } from "@/app/services/adminApi";
import { chatApi } from "@/app/services/chatApi";
import { supportApi } from "@/app/services/supportApi";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
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
} from "lucide-react";
import { cn } from "@/app/helpers/utils";

export const AdminNotifications = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabValues = ["all", "orders", "vendors", "listings", "chats", "support", "logs"] as const;
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

  // Fetch all orders to extract critical notifications
  const { data: orders = [], isLoading: isLoadingOrders, refetch: refetchOrders, isFetching: isFetchingOrders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders({ quiet: true }),
    refetchInterval: 30000,
  });

  // Fetch all vendors to find pending verification approvals
  const { data: vendors = [], isLoading: isLoadingVendors, refetch: refetchVendors, isFetching: isFetchingVendors } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => adminApi.getVendors({ quiet: true }),
    refetchInterval: 30000,
  });

  // Fetch all audit logs to render the Activity Stream
  const { data: logs = [], isLoading: isLoadingLogs, refetch: refetchLogs, isFetching: isFetchingLogs } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => adminApi.getAuditLogs(undefined, { quiet: true }),
    refetchInterval: 30000,
  });

  // Fetch all pending continuations (extensions & buyouts) globally
  const { data: pendingContinuations = [], isLoading: isLoadingContinuations, refetch: refetchContinuations, isFetching: isFetchingContinuations } = useQuery({
    queryKey: ["admin-all-pending-continuations"],
    queryFn: () => adminApi.getAdminAllPendingContinuations(),
    refetchInterval: 30000,
  });

  const { data: chatSessions = [], isLoading: isLoadingChats, refetch: refetchChats, isFetching: isFetchingChats } = useQuery({
    queryKey: ["admin-customer-chat-sessions"],
    queryFn: () => chatApi.getAdminSessions(),
    refetchInterval: 15000,
  });

  const { data: supportTickets = [], isLoading: isLoadingSupport, refetch: refetchSupport, isFetching: isFetchingSupport } = useQuery({
    queryKey: ["admin-vendor-support-tickets"],
    queryFn: () => supportApi.getAllTickets({ quiet: true }),
    refetchInterval: 15000,
  });

  const isLoading = isLoadingOrders || isLoadingVendors || isLoadingLogs || isLoadingContinuations || isLoadingChats || isLoadingSupport;
  const isFetching = isFetchingOrders || isFetchingVendors || isFetchingLogs || isFetchingContinuations || isFetchingChats || isFetchingSupport;

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchOrders(),
      refetchVendors(),
      refetchLogs(),
      refetchContinuations(),
      refetchChats(),
      refetchSupport(),
    ]);
  };

  // Process dispatch failed and critical alerts
  const criticalOrders = useMemo(() => {
    const list = orders
      .filter((o) => {
        const s = o.status.toLowerCase().replace(/_/g, " ");
        return s.includes("dispatch failed") || s.includes("cancelled");
      })
      .map((o) => ({
        id: `order-${o.orderId}-${o.status}`,
        type: "order" as const,
        title: `Order ${o.orderNumber.split("-").slice(0,3).join("-")} Dispatch Failed`,
        description: `Vendor dispatch reassignment failed for item "${o.listingTitle}". High priority action required.`,
        status: o.status,
        timestamp: o.createdOnUtc,
        meta: {
          listingTitle: o.listingTitle,
          customerName: o.customerName,
          vendorName: o.vendorName,
          amount: o.totalAmount,
        },
        link: "/admin/orders?tab=dispatch_failed",
      }));

    // Add extensions/buyouts alerts
    pendingContinuations.forEach(cont => {
      if (cont.type === "extension") {
        list.push({
          id: `ext-${cont.extensionId}`,
          type: "extension" as any,
          title: `Extension Requested: Order ${cont.orderNumber.split("-").slice(0,3).join("-")}`,
          description: `Customer requested an extension. Requires admin review.`,
          status: "pending_extension",
          timestamp: cont.createdOnUtc,
          meta: {
            listingTitle: cont.listingTitle,
            customerName: cont.customerName,
            vendorName: cont.vendorName,
            amount: cont.totalAmount,
            orderId: cont.orderId,
          },
          link: `/admin/orders`,
        });
      } else if (cont.type === "buyout") {
        list.push({
          id: `buy-${cont.extensionId}`,
          type: "buyout" as any,
          title: `Buyout Requested: Order ${cont.orderNumber.split("-").slice(0,3).join("-")}`,
          description: `Customer requested to buyout the rented item. Requires admin review.`,
          status: "pending_buyout",
          timestamp: cont.createdOnUtc,
          meta: {
            listingTitle: cont.listingTitle,
            customerName: cont.customerName,
            vendorName: cont.vendorName,
            amount: cont.totalAmount,
            orderId: cont.orderId,
          },
          link: `/admin/orders`,
        });
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, pendingContinuations]);

  // Process pending vendor verification alerts
  const pendingVendors = useMemo(() => {
    return vendors
      .filter((v) => v.accountStatus === "pending")
      .map((v) => ({
        id: `vendor-${v.id}`,
        type: "vendor" as const,
        title: "Vendor Onboarding Pending Approval",
        description: `New vendor "${v.companyName || v.fullName}" has submitted document details and requires validation.`,
        status: v.accountStatus,
        timestamp: (v as any).createdAt || new Date().toISOString(),
        meta: {
          name: v.fullName,
          company: v.companyName,
          email: v.email,
        },
        link: `/admin/vendors/${v.id}?tab=docs`,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [vendors]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [logs]);

  // Vendor listing create/update → Admin should review catalog pricing
  const listingAlerts = useMemo(() => {
    return logs
      .filter((l) => {
        const a = (l.actionType || "").toLowerCase();
        return a === "vendor.listing.created" || a === "vendor.listing.updated";
      })
      .map((l) => {
        const created = (l.actionType || "").toLowerCase().includes("created");
        let kind = "product";
        try {
          if (l.newValue) {
            const parsed = JSON.parse(l.newValue) as { kind?: string };
            if (parsed.kind === "chemical" || parsed.kind === "product") kind = parsed.kind;
          }
        } catch {
          /* ignore malformed JSON */
        }
        if ((l.notes || "").toLowerCase().includes("chemical")) kind = "chemical";
        return {
          id: `listing-${l.id}`,
          type: "listing" as const,
          title: created ? "New vendor listing needs pricing" : "Vendor listing updated",
          description: l.notes || `A vendor ${created ? "created" : "updated"} a ${kind} listing. Review catalog pricing.`,
          status: created ? "created" : "updated",
          timestamp: l.createdAt,
          meta: {
            kind,
            notes: l.notes,
            listingTitle: l.notes?.match(/listing "([^"]+)"/)?.[1] || "Listing",
          },
          link: kind === "chemical" ? "/admin/chemicals" : "/admin/products",
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs]);

  const chatAlerts = useMemo(() => {
    return chatSessions
      .filter((s) => (s.unreadCount ?? 0) > 0)
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
      .filter((t) => (t.unreadCount ?? 0) > 0)
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

  // Combine Alerts
  const allAlerts = useMemo(() => {
    const list = [...criticalOrders, ...pendingVendors, ...listingAlerts, ...chatAlerts, ...supportAlerts];
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [criticalOrders, pendingVendors, listingAlerts, chatAlerts, supportAlerts]);

  // Count Badges
  const counts = useMemo(() => ({
    all: allAlerts.length,
    orders: criticalOrders.length,
    vendors: pendingVendors.length,
    listings: listingAlerts.length,
    chats: chatAlerts.length,
    support: supportAlerts.length,
    logs: logs.length,
  }), [allAlerts, criticalOrders, pendingVendors, listingAlerts, chatAlerts, supportAlerts, logs]);

  // Helper to format audit log timeline icons
  const getLogIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("approve") || a.includes("verify") || a.includes("active")) {
      return <UserCheck className="h-4 w-4 text-emerald-500" />;
    }
    if (a.includes("reject") || a.includes("ban") || a.includes("suspend") || a.includes("failed")) {
      return <ShieldAlert className="h-4 w-4 text-destructive" />;
    }
    if (a.includes("catalog") || a.includes("product") || a.includes("category") || a.includes("listing")) {
      return <Package className="h-4 w-4 text-indigo-500" />;
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

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (totalItems <= PAGE_SIZE) return null;
    return (
      <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 mt-6">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} &middot; {totalItems} items
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Notifications Center"
        description="Consolidated monitoring, critical order alarms, pending onboarding verifications, and real-time activity stream."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isFetching || isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="h-auto w-full flex-nowrap overflow-x-auto justify-start bg-muted/40 p-1 mb-6">
          <TabsTrigger value="all" className="text-xs">
            All Alerts ({counts.all})
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

      {isLoading ? (
        <PageLoaderSlot />
      ) : (
        <div className="space-y-4">
          {/* TAB: ALL ALERTS */}
          {activeTab === "all" && (
            allAlerts.length === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">All Clear!</h3>
                <p className="mt-1 text-sm text-muted-foreground">No urgent dispatch failures, onboarding requests, or listing pricing alerts.</p>
              </Card>
            ) : (
              <div>
                {allAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(allAlerts.length)}
              </div>
            )
          )}

          {/* TAB: DISPATCH FAILURES */}
          {activeTab === "orders" && (
            criticalOrders.length === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">Zero Dispatch Failures</h3>
                <p className="mt-1 text-sm text-muted-foreground">All orders have been successfully confirmed or dispatched to vendors.</p>
              </Card>
            ) : (
              <div>
                {criticalOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(criticalOrders.length)}
              </div>
            )
          )}

          {/* TAB: PENDING VENDORS */}
          {activeTab === "vendors" && (
            pendingVendors.length === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Onboarding Approvals Pending</h3>
                <p className="mt-1 text-sm text-muted-foreground">All registered vendors have been fully processed and verified.</p>
              </Card>
            ) : (
              <div>
                {pendingVendors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(pendingVendors.length)}
              </div>
            )
          )}

          {/* TAB: LISTING PRICING */}
          {activeTab === "listings" && (
            listingAlerts.length === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">No Listing Pricing Alerts</h3>
                <p className="mt-1 text-sm text-muted-foreground">No recent vendor product or chemical listing create/update events requiring pricing review.</p>
              </Card>
            ) : (
              <div>
                {listingAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(listingAlerts.length)}
              </div>
            )
          )}

          {/* TAB: CUSTOMER CHATS */}
          {activeTab === "chats" && (
            chatAlerts.length === 0 ? (
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
                {chatAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(chatAlerts.length)}
              </div>
            )
          )}

          {/* TAB: VENDOR SUPPORT */}
          {activeTab === "support" && (
            supportAlerts.length === 0 ? (
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
                {supportAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((alert) => (
                  <div key={alert.id} className="mb-4 last:mb-0">
                    <AlertCard alert={alert} navigate={navigate} />
                  </div>
                ))}
                {renderPagination(supportAlerts.length)}
              </div>
            )
          )}

          {/* TAB: SYSTEM ACTIVITY STREAM */}
          {activeTab === "logs" && (
            sortedLogs.length === 0 ? (
              <Card className="border-border/60 p-12 text-center">
                <p className="text-sm text-muted-foreground">No recent system activity logs recorded.</p>
              </Card>
            ) : (
              <Card className="border-border/60 p-6 sm:p-8">
                <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-primary" /> Live Audit Log Feed
                </h3>
                <div className="relative border-l border-border pl-6 ml-3 mt-2 space-y-6">
                  {sortedLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((log) => (
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
                {renderPagination(sortedLogs.length)}
              </Card>
            )
          )}
        </div>
      )}
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
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-all hover:border-border/100 hover:shadow-md sm:p-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <div className={cn(
          "rounded-lg p-2.5 shrink-0 mt-0.5",
          alert.type === "order" ? "bg-destructive/10 text-destructive" 
          : alert.type === "extension" ? "bg-blue-500/10 text-blue-500"
          : alert.type === "buyout" ? "bg-fuchsia-500/10 text-fuchsia-500"
          : alert.type === "listing" ? "bg-indigo-500/10 text-indigo-500"
          : alert.type === "chat" || alert.type === "support" ? "bg-primary/10 text-primary"
          : "bg-amber-500/10 text-amber-500"
        )}>
          {alert.type === "order" ? <AlertTriangle className="h-5 w-5" /> 
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
              alert.type === "order"
                ? "bg-destructive/15 text-destructive border-destructive/20"
                : alert.type === "extension"
                ? "bg-blue-100 text-blue-800 border-blue-500/20 dark:bg-blue-900/30 dark:text-blue-300"
                : alert.type === "buyout"
                ? "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-500/20 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
                : alert.type === "listing"
                ? "bg-indigo-100 text-indigo-800 border-indigo-500/20 dark:bg-indigo-900/30 dark:text-indigo-300"
                : alert.type === "chat" || alert.type === "support"
                ? "bg-primary/15 text-primary border-primary/20"
                : "bg-amber-100 text-amber-950 border-amber-500/20"
            )}>
              {alert.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{alert.description}</p>
          
          {/* Metadata chips */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground pt-1.5">
            {alert.type === "order" || alert.type === "extension" || alert.type === "buyout" ? (
              <>
                <p>Listing: <span className="text-foreground">{alert.meta.listingTitle}</span></p>
                <p>Customer: <span className="text-foreground">{alert.meta.customerName}</span></p>
                <p>Total Amount: <span className="text-primary font-bold">₹{alert.meta.amount.toFixed(0)}</span></p>
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
          {alert.type === "listing"
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

export default AdminNotifications;
