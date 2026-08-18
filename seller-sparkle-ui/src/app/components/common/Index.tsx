import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";
import { getPortalHostKind } from "@/app/helpers/portalHost";
import Home from "@/app/components/landing/Home";
import { useQuery } from "@tanstack/react-query";
import { websiteContentApi } from "@/app/services/websiteContentApi";
import { BrandBootSplash } from "@/app/components/shared/BrandMark";

const Index = () => {
  const { user, isHydrating } = useAuth();
  const portal = getPortalHostKind();

  const { data: publicContent, isLoading } = useQuery({
    queryKey: ["publicWebsiteContent"],
    queryFn: () => websiteContentApi.getPublicContent(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

    if (isHydrating && portal !== "customer") return <BrandBootSplash />;

  if (!user) {
    if (portal === "admin") return <Navigate to="/admin/login" replace />;
    if (portal === "vendor") return <Navigate to="/login" replace />;

    // Redirect to customer shop if Landing Page is disabled in Website Settings
    if (publicContent?.settings?.showLandingPage === false) {
      return <Navigate to="/customer/shop" replace />;
    }

    return <Home />;
  }

  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "customer") return <Navigate to="/customer/shop" replace />;
  return <Navigate to="/vendor" replace />;
};

export default Index;


