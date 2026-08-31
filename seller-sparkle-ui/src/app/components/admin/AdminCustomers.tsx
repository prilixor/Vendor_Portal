import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { adminApi, AdminCustomerDetailDto, AdminCustomerListItemDto } from "@/app/services/adminApi";
import { AdminPlaceCustomerOrderDialog } from "@/app/components/admin/AdminPlaceCustomerOrderDialog";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { Loader2, LogIn, Mail, MapPin, Phone, Search, ShoppingCart, ChevronRight, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/guards/AuthContext";
import { ADMIN_PERMISSIONS } from "@/app/helpers/adminNav";
import { getCustomerPortalHref } from "@/app/helpers/portalHost";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { formatOrderStatusLabel, formatOrderStatusTitle, orderStatusBadgeSizeClass } from "@/app/helpers/orderStatus";
import { cn } from "@/app/helpers/utils";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";

const PAGE_SIZE = 8;
const ORDERS_PAGE_SIZE = 10;

function formatMoney(amount: number) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase().replace(/_/g, " ");
  if (s === "pending" || s.includes("awaiting")) {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (s === "confirmed") {
    return "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
  }
  if (s.includes("transit") || s === "shipped out") {
    return "bg-violet-100 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
  }
  if (s === "active") {
    return "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white";
  }
  if (s === "returned") {
    return "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200";
  }
  if (s === "cancelled" || s === "canceled") {
    return "bg-muted text-muted-foreground";
  }
  if (s.includes("dispatch failed")) {
    return "bg-destructive/10 text-destructive border-destructive/20";
  }
  return "bg-muted text-foreground border-border";
}

export const AdminCustomers = () => {
  const [rows, setRows] = useState<AdminCustomerListItemDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const { hasPermission } = useAuth();

  const load = async (q?: string) => {
    setLoading(true);
    try {
      setRows(await adminApi.getAdminCustomers(q));
      setPage(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage],
  );

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Directory of customer accounts. Place orders on behalf of a customer from their detail page."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Customers" },
        ]}
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <div className="flex gap-2">
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, phone"
            onKeyDown={(e) => {
              if (e.key === "Enter") load(search);
            }}
          />
          <Button onClick={() => load(search)} variant="secondary" className="shrink-0">
            Search
          </Button>
        </div>
      </div>
      {loading ? (
        <PageLoaderSlot className="min-h-[8rem] py-0" />
      ) : (
        <div className="space-y-2">
          {pageRows.map((c) => {
            const initials = c.fullName
              .split(/\s+/)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "?";
            return (
              <Card
                key={c.id}
                className="overflow-hidden border-border/70 p-0 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
              >
                <Link
                  to={`/admin/customers/${c.id}`}
                  className="flex items-center gap-3 p-4 text-left text-foreground no-underline sm:gap-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials || <UserRound className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{c.fullName}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          c.isEmailVerified
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
                        )}
                      >
                        {c.isEmailVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-sm">
                      <CopyableEmail email={c.email} textClassName="text-sm font-medium text-sky-600 dark:text-sky-400" />
                      {c.phone ? (
                        <span className="truncate font-medium text-violet-600 dark:text-violet-400">
                          · {c.phone}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.orderCount} {c.orderCount === 1 ? "order" : "orders"} · Joined {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary sm:inline-flex">
                    View <ChevronRight className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
                </Link>
              </Card>
            );
          })}
          {rows.length === 0 && (
            <div className="space-y-2 rounded-xl border border-dashed py-14 text-center">
              <UserRound className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No customers found</p>
              <p className="text-xs text-muted-foreground">Try a different email, name, or phone.</p>
            </div>
          )}
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={rows.length}
            onPageChange={setPage}
            label="customers"
          />
        </div>
      )}
      {!hasPermission(ADMIN_PERMISSIONS.customersView) && (
        <p className="text-sm text-destructive">You may not have customers.view permission.</p>
      )}
    </div>
  );
};

export const AdminCustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [detail, setDetail] = useState<AdminCustomerDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);

  const reload = async () => {
    if (!customerId) return;
    const d = await adminApi.getAdminCustomer(customerId);
    setDetail(d);
  };

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      setLoading(true);
      try {
        await reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load customer");
        navigate("/admin/customers");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per customerId
  }, [customerId, navigate]);

  const orders = detail?.recentOrders ?? [];
  const ordersTotalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const safeOrdersPage = Math.min(ordersPage, ordersTotalPages);
  const pageOrders = orders.slice((safeOrdersPage - 1) * ORDERS_PAGE_SIZE, safeOrdersPage * ORDERS_PAGE_SIZE);

  if (loading || !detail) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.fullName}
        description={detail.email}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Customers", href: "/admin/customers" },
          { label: detail.fullName },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission(ADMIN_PERMISSIONS.customersImpersonate) && customerId && (
              <Button
                variant="secondary"
                disabled={impersonating}
                onClick={async () => {
                  setImpersonating(true);
                  try {
                    const result = await adminApi.impersonateCustomer(customerId);
                    const href = getCustomerPortalHref(
                      `/impersonation/consume?code=${encodeURIComponent(result.exchangeCode)}`,
                    );
                    window.open(href, "_blank", "noopener,noreferrer");
                    toast.success(`Opened ${result.targetName} in a new tab. Your admin session stays here.`);
                  } catch (e) {
                    toast.error(getUserFriendlyMessage(e));
                  } finally {
                    setImpersonating(false);
                  }
                }}
              >
                {impersonating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                Open as Customer
              </Button>
            )}
            {hasPermission(ADMIN_PERMISSIONS.customersPlaceOrder) && (
              <Button onClick={() => setOpen(true)}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Create order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Account</h3>
            <Badge variant="outline" className={cn(
              "text-[10px]",
              detail.isEmailVerified
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200",
            )}>
              {detail.isEmailVerified ? "Email verified" : "Email unverified"}
            </Badge>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="break-all font-medium">
                  <CopyableEmail
                    email={detail.email}
                    compact={false}
                    textClassName="break-all font-medium text-sky-600 dark:text-sky-400"
                  />
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-violet-600 dark:text-violet-400">{detail.phone || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Joined</p>
                <p className="font-medium text-foreground">{formatDate(detail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last login</p>
                <p className="font-medium text-foreground">{formatDate(detail.lastLoginAt)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Addresses</h3>
          </div>
          {detail.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses on file.</p>
          ) : (
            <div className="space-y-3">
              {detail.addresses.map((a) => (
                <div key={a.id} className="rounded-md border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{a.label || "Address"}</p>
                    {a.isDefault && (
                      <Badge variant="secondary" className="text-[10px]">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.line1}, {a.city}, {a.state} {a.postal}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Orders</h3>
          <p className="text-xs text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
          </p>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <>
            <div className="divide-y rounded-md border">
              {pageOrders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/admin/orders/${encodeURIComponent(o.id)}`)}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{o.orderNumber}</span>
                      <Badge
                        title={formatOrderStatusTitle(o.status)}
                        variant="outline"
                        className={cn(orderStatusBadgeSizeClass, orderStatusBadgeClass(o.status))}
                      >
                        {formatOrderStatusLabel(o.status)}
                      </Badge>
                      {o.placedByAdminId && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                          By admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{formatMoney(o.totalAmount)}</span>
                </button>
              ))}
            </div>
            <TablePagination
              page={safeOrdersPage}
              pageSize={ORDERS_PAGE_SIZE}
              total={orders.length}
              onPageChange={setOrdersPage}
              label="orders"
            />
          </>
        )}
      </Card>

      {customerId && (
        <AdminPlaceCustomerOrderDialog
          open={open}
          onOpenChange={setOpen}
          customerId={customerId}
          customer={detail}
          onPlaced={() => { void reload(); }}
        />
      )}
    </div>
  );
};

export default AdminCustomers;
