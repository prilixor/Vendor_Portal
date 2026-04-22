import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { vendorNav, adminNav } from "@/app/helpers/navigation";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

interface AppShellProps {
  variant: "vendor" | "admin";
}

export const AppShell = ({ variant }: AppShellProps) => {
  const { user, isHydrating } = useAuth();
  const { pathname } = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!user || variant !== "vendor") {
        setUnreadNotifications(0);
        return;
      }

      try {
        const notifications = await vendorOnboardingApi.getVendorNotifications(user.id);
        const unread = notifications.filter((n) => n.status.trim().toLowerCase() !== "read" && !n.readAt).length;
        setUnreadNotifications(unread);
      } catch {
        setUnreadNotifications(0);
      }
    };

    void loadUnreadCount();
  }, [user, variant, pathname]);

  const navSections = useMemo(() => {
    if (variant !== "vendor") {
      return adminNav;
    }

    return vendorNav.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.to === "/vendor/notifications"
          ? { ...item, badge: unreadNotifications > 0 ? String(unreadNotifications) : undefined }
          : item),
    }));
  }, [variant, unreadNotifications]);

  if (isHydrating) return <div className="min-h-screen w-full bg-background" />;

  if (!user) return <Navigate to="/login" replace />;

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
        sections={navSections}
        brandLabel={variant === "admin" ? "Admin Console" : "Vendor Workspace"}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onMenuClick={() => setMobileSidebarOpen(true)}
          unreadNotifications={variant === "vendor" ? unreadNotifications : 0}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};


