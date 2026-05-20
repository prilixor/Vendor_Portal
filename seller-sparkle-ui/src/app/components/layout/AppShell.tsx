import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { vendorNav, adminNav, customerNav } from "@/app/helpers/navigation";
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
    variant === "admin" ? adminNav : variant === "customer" ? customerNav : vendorNav;
  const brandLabel =
    variant === "admin"
      ? "Admin Console"
      : variant === "customer"
        ? "Rent · Manage · Return"
        : "Vendor Workspace";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        sections={sections}
        brandHeading={variant === "customer" ? "Customer Portal" : undefined}
        brandLabel={brandLabel}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <NotificationProvider vendorId={variant === "vendor" ? user?.id : undefined}>
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
        </NotificationProvider>
      </div>
    </div>
  );
};
