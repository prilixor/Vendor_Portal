import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { vendorNav, customerNav } from "@/app/helpers/navigation";
import { getAdminNav } from "@/app/helpers/adminNav";
import { adminApi } from "@/app/services/adminApi";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { NotificationProvider } from "@/app/contexts/NotificationContext";
import { PendingApprovalBanner } from "@/app/components/vendor/PendingApprovalBanner";
import { SupportChat } from "@/app/components/support/SupportChat";

interface AppShellProps {
  variant: "vendor" | "admin" | "customer";
}

function customerBrowseAndCartPaths(pathname: string): boolean {
  if (pathname === "/customer") return true;
  if (pathname.startsWith("/customer/browse")) return true;
  if (pathname === "/customer/cart") return true;
  return false;
}

export const AppShell = ({ variant }: AppShellProps) => {
  const { user, isHydrating } = useAuth();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [statusCheckDone, setStatusCheckDone] = useState(false);

  useEffect(() => {
    if (variant === "vendor" && user) {
      const checkAccountStatus = async () => {
        try {
          const status = await vendorOnboardingApi.getVendorStatus(user.id);
          setAccountStatus(status.accountStatus);
        } catch (error) {
          console.error("Failed to check account status:", error);
          setAccountStatus(null);
        } finally {
          setStatusCheckDone(true);
        }
      };

      checkAccountStatus();

      const interval = setInterval(() => {
        setAccountStatus((currentStatus) => {
          if (currentStatus === "pending") {
            checkAccountStatus();
          }
          return currentStatus;
        });
      }, 30000);

      const handleFocus = () => {
        setAccountStatus((currentStatus) => {
          if (currentStatus === "pending") {
            checkAccountStatus();
          }
          return currentStatus;
        });
      };

      window.addEventListener("focus", handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", handleFocus);
      };
    } else {
      setStatusCheckDone(true);
    }
  }, [variant, user]);

  useEffect(() => {
    if (variant === "admin") {
      document.title = "Admin Portal — Prilixor";
    } else if (variant === "customer") {
      document.title = "Customer Portal — Prilixor";
    } else {
      document.title = "Vendor Portal — Manage Your Marketplace Business";
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

  const isPending = accountStatus === "pending";

  const sections =
    variant === "admin" ? getAdminNav(unreadAdminCount) : variant === "customer" ? customerNav : vendorNav;
  const brandLabel =
    variant === "admin"
      ? "Admin Console"
      : variant === "customer"
        ? "Rent · Manage · Return"
        : "Vendor Workspace";

  return (
    <NotificationProvider vendorId={variant === "vendor" ? user?.id : undefined}>
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
          brandHeading={
            variant === "customer"
              ? "Customer Portal"
              : variant === "admin"
                ? "Admin Portal"
                : undefined
          }
          brandLabel={brandLabel}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar variant={variant} onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              {variant === "vendor" && statusCheckDone && isPending && (
                <PendingApprovalBanner className="mb-6" />
              )}
              <Outlet />
            </div>
          </main>
          {variant === "vendor" && user && <SupportChat vendorId={user.id} />}
        </div>
      </div>
    </NotificationProvider>
  );
};
