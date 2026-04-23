import { Outlet, Navigate, useNavigate } from "react-router-dom";



import { useState, useEffect } from "react";



import { Sidebar } from "./Sidebar";



import { TopBar } from "./TopBar";



import { vendorNav, adminNav } from "@/app/helpers/navigation";



import { useAuth } from "@/app/guards/AuthContext";

import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

import { getVendorNav } from "@/app/helpers/vendorNav";







interface AppShellProps {



  variant: "vendor" | "admin";



}







export const AppShell = ({ variant }: AppShellProps) => {



  const { user, isHydrating } = useAuth();

  const navigate = useNavigate();



  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);



  const [unreadCount, setUnreadCount] = useState(0);







  useEffect(() => {



    if (variant === "vendor" && user) {



      vendorOnboardingApi.getVendorNotifications(user.id)



        .then(notifications => {



          const unread = notifications.filter(n => n.status.trim().toLowerCase() !== "read" && !n.readAt).length;



          setUnreadCount(unread);



        })



        .catch(() => setUnreadCount(0));



    }



  }, [variant, user]);



  // Auth check - redirect if not authenticated or wrong role

  useEffect(() => {

    if (!isHydrating) {

      console.log("AppShell auth check:", { variant, user, isHydrating });

      if (variant === "admin" && (!user || user.role !== "admin")) {

        console.log("AppShell: Redirecting to admin login");
        navigate("/admin/login", { replace: true });

      } else if (variant === "vendor" && (!user || user.role !== "vendor")) {

        console.log("AppShell: Redirecting to vendor login");
        navigate("/login", { replace: true });

      }

    }

  }, [variant, user, isHydrating, navigate]);







  if (isHydrating) return <div className="min-h-screen w-full bg-background" />;







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



        sections={variant === "admin" ? adminNav : getVendorNav(unreadCount)}



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











