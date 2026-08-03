import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";
import { getPortalHostKind } from "@/app/helpers/portalHost";
import { BrandBootSplash } from "@/app/components/shared/BrandMark";

const Index = () => {
  const { user, isHydrating } = useAuth();
  const portal = getPortalHostKind();

  if (isHydrating) return <BrandBootSplash />;

  if (!user) {
    if (portal === "admin") return <Navigate to="/admin/login" replace />;
    // Customer/www + local (localhost): storefront first. Vendor host stays login-first.
    if (portal === "customer" || portal === "local") {
      return <Navigate to="/customer/shop" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "customer") return <Navigate to="/customer/shop" replace />;
  return <Navigate to="/vendor" replace />;
};

export default Index;
