import { Navigate, useLocation } from "react-router-dom";

import { useState, useEffect, useMemo, useCallback } from "react";

import { useQuery } from "@tanstack/react-query";

import { Sidebar } from "./Sidebar";

import { TopBar } from "./TopBar";

import { MobileNavScrim, useMobileNavLock } from "./MobileNavScrim";

import { cn } from "@/app/helpers/utils";

import { CustomerStoreHeader } from "./CustomerStoreHeader";

import { vendorNav, customerNav, guestCustomerNav } from "@/app/helpers/navigation";

import { getAdminNav } from "@/app/helpers/adminNav";

import { getVendorNav } from "@/app/helpers/vendorNav";

import { getAdminPortalHref } from "@/app/helpers/portalHost";
import { clearImpersonationSession } from "@/app/helpers/authSession";

import { adminApi } from "@/app/services/adminApi";
import { chatApi } from "@/app/services/chatApi";
import { supportApi } from "@/app/services/supportApi";

import { useAuth } from "@/app/guards/AuthContext";

import { NotificationProvider, useNotificationContext } from "@/app/contexts/NotificationContext";
import {
  VendorDispatchOffersProvider,
  useVendorDispatchOffersContext,
} from "@/app/contexts/VendorDispatchOffersContext";

import { SupportChatProvider } from "@/app/contexts/SupportChatContext";

import {

  VendorVerificationProvider,

  useVendorVerification,

} from "@/app/contexts/VendorVerificationContext";

import { VendorVerificationBanner } from "@/app/components/vendor/VendorVerificationBanner";

import { SupportChat } from "@/app/components/support/SupportChat";
import { BrandBootSplash } from "@/app/components/shared/BrandMark";
import { PortalGlobalLoader } from "@/app/components/shared/PortalGlobalLoader";



interface AppShellProps {

  variant: "vendor" | "admin" | "customer";

}



function customerBrowseAndCartPaths(pathname: string): boolean {

  if (pathname === "/customer") return true;

  if (pathname.startsWith("/customer/shop")) return true;

  if (pathname === "/customer/cart") return true;

  return false;

}



function VendorShellContent({

  user,

  mobileSidebarOpen,

  setMobileSidebarOpen,

}: {

  user: NonNullable<ReturnType<typeof useAuth>["user"]>;

  mobileSidebarOpen: boolean;

  setMobileSidebarOpen: (open: boolean) => void;

}) {

  const { unreadCount: unreadVendorCount } = useNotificationContext();
  const { pendingCount: pendingOrderRequestsCount } = useVendorDispatchOffersContext();

  const verification = useVendorVerification();

  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [setMobileSidebarOpen]);

  useMobileNavLock(mobileSidebarOpen, closeMobileSidebar);



  const sections = useMemo(

    () =>

      getVendorNav(unreadVendorCount, {

        pendingOrderRequestsCount,

        operationsBlocked: verification.operationsBlocked,

        blockedReason:

          verification.bannerVariant === "missing_docs"

            ? "Upload all required documents to unlock this section."

            : verification.bannerVariant === "rejected"

              ? "Fix rejected verification items to unlock this section."

              : "Available once your account is approved.",

      }),

    [unreadVendorCount, pendingOrderRequestsCount, verification.operationsBlocked, verification.bannerVariant],

  );



  return (

    <div className="flex min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-background">

      <MobileNavScrim open={mobileSidebarOpen} onClose={closeMobileSidebar} className="lg:hidden" />



      <Sidebar

        variant="vendor"

        sections={sections}

        brandLabel="Vendor Workspace"

        isOpen={mobileSidebarOpen}

        onClose={closeMobileSidebar}

      />



      <div
        className={cn(
          "relative z-0 flex min-w-0 flex-1 flex-col overflow-x-clip",
          mobileSidebarOpen && "max-lg:pointer-events-none max-lg:select-none",
        )}
        aria-hidden={mobileSidebarOpen || undefined}
      >

        <TopBar variant="vendor" onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="relative z-0 min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-24 sm:px-6 sm:py-6 lg:px-8">

          <div className="mx-auto w-full min-w-0 max-w-7xl">

            {user.impersonation && (

              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">

                <span>

                  Impersonating <strong>{user.name}</strong>. Sensitive actions (password/bank) are blocked.

                </span>

                <button

                  type="button"

                  className="font-semibold text-primary underline"

                  onClick={() => {
                    clearImpersonationSession();
                    window.location.href = getAdminPortalHref("/admin/vendors");
                  }}

                >

                  Exit to Admin

                </button>

              </div>

            )}

            {verification.isReady && verification.operationsBlocked && (

              <VendorVerificationBanner className="mb-6" />

            )}

            <PortalGlobalLoader placement="main" />

          </div>

        </main>

        <SupportChat vendorId={user.id} />

      </div>

    </div>

  );

}



export const AppShell = ({ variant }: AppShellProps) => {

  const { user, isHydrating } = useAuth();

  const location = useLocation();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const isCustomerShell = variant === "customer";

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);



  useMobileNavLock(variant === "admin" && mobileSidebarOpen, closeMobileSidebar);

  useEffect(() => {

    if (variant === "admin") {

      document.title = "Admin Portal — BlinksMed";

    } else if (variant === "customer") {

      document.title = "Customer Portal — BlinksMed";

    } else {

      document.title = "Vendor Portal — BlinksMed";

    }

  }, [variant]);



  const { data: adminOrders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders({ quiet: true }),
    enabled: variant === "admin" && !!user,
    refetchInterval: 30000,
  });

  const { data: adminVendors = [] } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => adminApi.getVendors({ quiet: true }),
    enabled: variant === "admin" && !!user,
    refetchInterval: 30000,
  });

  const { data: adminAuditLogs = [] } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => adminApi.getAuditLogs(undefined, { quiet: true }),
    enabled: variant === "admin" && !!user,
    refetchInterval: 30000,
  });

  const { data: adminChatUnread } = useQuery({
    queryKey: ["admin-customer-chat-unread"],
    queryFn: () => chatApi.getAdminUnreadCount(),
    enabled: variant === "admin" && !!user,
    refetchInterval: 15000,
  });

  const { data: adminSupportUnread } = useQuery({
    queryKey: ["admin-vendor-support-unread"],
    queryFn: () => supportApi.getAdminUnreadCount(),
    enabled: variant === "admin" && !!user,
    refetchInterval: 15000,
  });

  const customerChatUnread = adminChatUnread?.count ?? 0;
  const vendorSupportUnread = adminSupportUnread?.count ?? 0;

  const unreadAdminCount = useMemo(() => {
    const criticalOrders = (adminOrders || []).filter((o) => {
      if (!o || !o.status) return false;
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s.includes("dispatch failed") || s.includes("cancelled");
    }).length;

    const pendingVendors = (adminVendors || []).filter((v) => v && v.accountStatus === "pending").length;

    const listingPricingAlerts = (adminAuditLogs || []).filter((l) => {
      const a = (l.actionType || "").toLowerCase();
      return a === "vendor.listing.created" || a === "vendor.listing.updated";
    }).length;

    // Live unread Customer→Admin + Vendor→Admin support (clears when admin opens the thread).
    return criticalOrders + pendingVendors + listingPricingAlerts + customerChatUnread + vendorSupportUnread;
  }, [adminOrders, adminVendors, adminAuditLogs, customerChatUnread, vendorSupportUnread]);



  // Never cover the customer shop with the boot splash. Browse has its own loader.
  if (isHydrating && variant !== "customer") {
    return <BrandBootSplash />;
  }



  if (variant === "admin" && (!user || user.role !== "admin")) {

    return <Navigate to="/admin/login" replace />;

  }



  if (variant === "vendor" && (!user || user.role !== "vendor")) {

    return <Navigate to="/login" replace />;

  }



  if (variant === "customer") {

    const path = location.pathname;

    const open = customerBrowseAndCartPaths(path);

    const okCustomer = user?.role === "customer";

    if (!open && (!user || !okCustomer)) {

      return <Navigate to="/customer/login" replace state={{ from: path }} />;

    }

  }



  const sections =

    variant === "admin"

      ? getAdminNav(unreadAdminCount, user?.permissions, customerChatUnread, vendorSupportUnread)

      : variant === "customer"

        ? user?.role === "customer"

          ? customerNav

          : guestCustomerNav

        : vendorNav;

  const brandLabel =

    variant === "admin"

      ? "Admin Console"

      : variant === "customer"

        ? "Rent · Manage · Return"

        : "Vendor Workspace";



  return (

    <NotificationProvider vendorId={variant === "vendor" ? user?.id : undefined}>
      <VendorDispatchOffersProvider vendorId={variant === "vendor" ? user?.id : undefined}>
      <SupportChatProvider>

        {isCustomerShell ? (

          <div className="flex min-h-screen w-full min-w-0 max-w-full flex-col bg-gradient-to-b from-muted/40 via-background to-background">

            <CustomerStoreHeader />

            {user?.role === "customer" && user.impersonation && (

              <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">

                <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">

                  <span>

                    Impersonating <strong>{user.name}</strong>. Password changes are blocked.

                  </span>

                  <button

                    type="button"

                    className="font-semibold text-primary underline"

                    onClick={() => {
                      clearImpersonationSession();
                      window.location.href = getAdminPortalHref("/admin/customers");
                    }}

                  >

                    Exit to Admin

                  </button>

                </div>

              </div>

            )}

            <main className="min-w-0 flex-1 overflow-x-clip px-3 py-4 sm:px-6 sm:py-6 lg:px-8">

              <div className="mx-auto w-full min-w-0 max-w-[1400px]">

                <PortalGlobalLoader placement="chrome" />

              </div>

            </main>

          </div>

        ) : variant === "vendor" && user ? (

          <VendorVerificationProvider>

            <VendorShellContent

              user={user}

              mobileSidebarOpen={mobileSidebarOpen}

              setMobileSidebarOpen={setMobileSidebarOpen}

            />

          </VendorVerificationProvider>

        ) : (

          <div className="flex min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-background">

            <MobileNavScrim open={mobileSidebarOpen} onClose={closeMobileSidebar} className="lg:hidden" />



            <Sidebar

              variant={variant}

              sections={sections}

              brandHeading={variant === "admin" ? "Admin Portal" : undefined}

              brandLabel={brandLabel}

              isOpen={mobileSidebarOpen}

              onClose={closeMobileSidebar}

            />



            <div
              className={cn(
                "relative z-0 flex min-w-0 flex-1 flex-col overflow-x-clip",
                mobileSidebarOpen && "max-lg:pointer-events-none max-lg:select-none",
              )}
              aria-hidden={mobileSidebarOpen || undefined}
            >

              <TopBar variant={variant} onMenuClick={() => setMobileSidebarOpen(true)} />

              <main className="relative z-0 min-w-0 flex-1 overflow-x-clip px-3 py-4 sm:px-6 lg:px-8">

                <div className="mx-auto w-full min-w-0 max-w-7xl">

                  <PortalGlobalLoader placement="main" />

                </div>

              </main>

            </div>

          </div>

        )}

      </SupportChatProvider>

      </VendorDispatchOffersProvider>

    </NotificationProvider>

  );

};

