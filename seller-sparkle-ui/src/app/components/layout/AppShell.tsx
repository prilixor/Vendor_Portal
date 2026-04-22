import { Outlet, Navigate } from "react-router-dom";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { vendorNav, adminNav } from "@/app/helpers/navigation";
import { useAuth } from "@/app/guards/AuthContext";

interface AppShellProps {
  variant: "vendor" | "admin";
}

export const AppShell = ({ variant }: AppShellProps) => {
  const { user, isHydrating } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
        sections={variant === "admin" ? adminNav : vendorNav}
        brandLabel={variant === "admin" ? "Admin Console" : "Vendor Workspace"}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};


