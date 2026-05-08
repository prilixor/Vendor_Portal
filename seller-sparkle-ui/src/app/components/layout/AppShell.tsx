import { Outlet, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { vendorNav, adminNav } from "@/app/helpers/navigation";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { NotificationProvider, useNotificationContext } from "@/app/contexts/NotificationContext";
import { PendingApprovalBanner } from "@/app/components/vendor/PendingApprovalBanner";

interface AppShellProps {



  variant: "vendor" | "admin";



}







export const AppShell = ({ variant }: AppShellProps) => {
  const { user, isHydrating } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [statusCheckDone, setStatusCheckDone] = useState(false);

  // Check vendor account status for vendor routes
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

      // Initial check
      checkAccountStatus();

      // Set up periodic checking for pending vendors (every 30 seconds)
      const interval = setInterval(() => {
        // Only check if currently pending (check current state)
        setAccountStatus(currentStatus => {
          if (currentStatus === "pending") {
            checkAccountStatus();
          }
          return currentStatus;
        });
      }, 30000);

      // Also check when window gains focus (user returns to the tab)
      const handleFocus = () => {
        setAccountStatus(currentStatus => {
          if (currentStatus === "pending") {
            checkAccountStatus();
          }
          return currentStatus;
        });
      };

      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    } else {
      setStatusCheckDone(true);
    }
  }, [variant, user]);

  if (isHydrating) return <div className="min-h-screen w-full bg-background" />;

  // Auth check - redirect if not authenticated or wrong role
  if (variant === "admin" && (!user || user.role !== "admin")) {
    return <Navigate to="/admin/login" replace />;
  }

  if (variant === "vendor" && (!user || user.role !== "vendor")) {
    return <Navigate to="/login" replace />;
  }

  const isPending = accountStatus === "pending";







  return (



    <div className="flex min-h-screen w-full bg-background">



      {/* Mobile overlay */}



      {mobileSidebarOpen && (



        <div 



          className="fixed inset-0 z-50 bg-black/50 lg:hidden"



          onClick={() => setMobileSidebarOpen(false)}



        />



      )}



      



      <Sidebar
        sections={variant === "admin" ? adminNav : vendorNav}
        brandLabel={variant === "admin" ? "Admin Console" : "Vendor Workspace"}



        isOpen={mobileSidebarOpen}



        onClose={() => setMobileSidebarOpen(false)}



      />



      



      <div className="flex min-w-0 flex-1 flex-col">
        <NotificationProvider vendorId={variant === "vendor" ? user?.id : undefined}>
          <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              {variant === "vendor" && statusCheckDone && isPending && (
                <PendingApprovalBanner className="mb-6" />
              )}
              <Outlet />
            </div>
          </main>
        </NotificationProvider>
      </div>



    </div>



  );



};











