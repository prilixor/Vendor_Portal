import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [onboardingCheckDone, setOnboardingCheckDone] = useState(false);
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = useState(false);
  const location = useLocation();

  // Check vendor onboarding status for vendor routes (non-blocking)
  useEffect(() => {
    if (variant === "vendor" && user) {
      const checkOnboardingStatus = async () => {
        try {
          const status = await vendorOnboardingApi.getVendorStatus(user.id);
          // Allow access if registrationStage is under_review, approved, or rejected
          // Redirect to onboarding if still in early stages
          const allowedStages = ["under_review", "approved", "rejected"];
          if (!allowedStages.includes(status.registrationStage)) {
            setShouldRedirectToOnboarding(true);
          }
        } catch (error) {
          // If we can't fetch status, allow access (fail open)
          console.error("Failed to check onboarding status:", error);
          setShouldRedirectToOnboarding(false);
        } finally {
          setOnboardingCheckDone(true);
        }
      };

      checkOnboardingStatus();
    } else {
      setOnboardingCheckDone(true);
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

  // Redirect to onboarding if needed and not already on onboarding page
  if (variant === "vendor" && onboardingCheckDone && shouldRedirectToOnboarding && location.pathname !== "/vendor/onboarding") {
    return <Navigate to="/vendor/onboarding" replace />;
  }







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











