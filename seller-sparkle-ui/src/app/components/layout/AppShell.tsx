import { Outlet, Navigate, useLocation } from "react-router-dom";

import { useState, useEffect, useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Sidebar } from "./Sidebar";

import { TopBar } from "./TopBar";

import { CustomerStoreHeader } from "./CustomerStoreHeader";

import { vendorNav, customerNav, guestCustomerNav } from "@/app/helpers/navigation";

import { getAdminNav } from "@/app/helpers/adminNav";

import { getVendorNav } from "@/app/helpers/vendorNav";

import { getAdminPortalHref } from "@/app/helpers/portalHost";

import { adminApi } from "@/app/services/adminApi";

import { useAuth } from "@/app/guards/AuthContext";

import { NotificationProvider, useNotificationContext } from "@/app/contexts/NotificationContext";

import { SupportChatProvider } from "@/app/contexts/SupportChatContext";

import {

  VendorVerificationProvider,

  useVendorVerification,

} from "@/app/contexts/VendorVerificationContext";

import { VendorVerificationBanner } from "@/app/components/vendor/VendorVerificationBanner";

import { SupportChat } from "@/app/components/support/SupportChat";



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

  const verification = useVendorVerification();



  const sections = useMemo(

    () =>

      getVendorNav(unreadVendorCount, {

        operationsBlocked: verification.operationsBlocked,

        blockedReason:

          verification.bannerVariant === "missing_docs"

            ? "Upload all required documents to unlock this section."

            : verification.bannerVariant === "rejected"

              ? "Fix rejected verification items to unlock this section."

              : "Available once your account is approved.",

      }),

    [unreadVendorCount, verification.operationsBlocked, verification.bannerVariant],

  );



  return (

    <div className="flex min-h-screen w-full bg-background">

      {mobileSidebarOpen && (

        <div

          className="fixed inset-0 z-50 bg-black/50 lg:hidden"

          onClick={() => setMobileSidebarOpen(false)}

        />

      )}



      <Sidebar

        variant="vendor"

        sections={sections}

        brandLabel="Vendor Workspace"

        isOpen={mobileSidebarOpen}

        onClose={() => setMobileSidebarOpen(false)}

      />



      <div className="flex min-w-0 flex-1 flex-col">

        <TopBar variant="vendor" onMenuClick={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">

          <div className="mx-auto max-w-7xl">

            {user.impersonation && (

              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">

                <span>

                  Impersonating <strong>{user.name}</strong>. Sensitive actions (password/bank) are blocked.

                </span>

                <button

                  type="button"

                  className="font-semibold text-primary underline"

                  onClick={() => {

                    localStorage.removeItem("vendor_portal_user");

                    localStorage.removeItem("vendor_portal_token");

                    localStorage.removeItem("impersonation_meta");

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

            <Outlet />

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

  const isCustomerShell = variant === "customer";



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

    queryFn: () => adminApi.getAdminOrders(),

    enabled: variant === "admin" && !!user,

    refetchInterval: 30000,

  });



  const { data: adminVendors = [] } = useQuery({

    queryKey: ["admin-vendors"],

    queryFn: () => adminApi.getVendors(),

    enabled: variant === "admin" && !!user,

    refetchInterval: 30000,

  });



  const unreadAdminCount = useMemo(() => {

    const criticalOrders = (adminOrders || []).filter((o) => {

      if (!o || !o.status) return false;

      const s = o.status.toLowerCase().replace(/_/g, " ");

      return s.includes("dispatch failed") || s.includes("cancelled");

    }).length;

    const pendingVendors = (adminVendors || []).filter((v) => v && v.accountStatus === "pending").length;

    return criticalOrders + pendingVendors;

  }, [adminOrders, adminVendors]);



  if (isHydrating) return <div className="min-h-screen w-full bg-background" />;



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

      ? getAdminNav(unreadAdminCount, user?.permissions)

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

      <SupportChatProvider>

        {isCustomerShell ? (

          <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-muted/40 via-background to-background">

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

                      localStorage.removeItem("vendor_portal_user");

                      localStorage.removeItem("vendor_portal_token");

                      localStorage.removeItem("impersonation_meta");

                      window.location.href = getAdminPortalHref("/admin/customers");

                    }}

                  >

                    Exit to Admin

                  </button>

                </div>

              </div>

            )}

            <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">

              <div className="mx-auto w-full max-w-[1400px]">

                <Outlet />

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

          <div className="flex min-h-screen w-full bg-background">

            {mobileSidebarOpen && (

              <div

                className="fixed inset-0 z-50 bg-black/50 lg:hidden"

                onClick={() => setMobileSidebarOpen(false)}

              />

            )}



            <Sidebar

              variant={variant}

              sections={sections}

              brandHeading={variant === "admin" ? "Admin Portal" : undefined}

              brandLabel={brandLabel}

              isOpen={mobileSidebarOpen}

              onClose={() => setMobileSidebarOpen(false)}

            />



            <div className="flex min-w-0 flex-1 flex-col">

              <TopBar variant={variant} onMenuClick={() => setMobileSidebarOpen(true)} />

              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">

                <div className="mx-auto max-w-7xl">

                  <Outlet />

                </div>

              </main>

            </div>

          </div>

        )}

      </SupportChatProvider>

    </NotificationProvider>

  );

};

