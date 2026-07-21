import { Navigate, useLocation } from "react-router-dom";
import { getPortalHostKind } from "@/app/helpers/portalHost";

/**
 * On production subdomains, send users to the correct portal login
 * when they open ambiguous paths like `/login`.
 * `/` is handled by Index (auth-aware). Localhost keeps path-based behaviour.
 */
export function PortalHostGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const portal = getPortalHostKind();
  const path = location.pathname;

  if (portal === "admin") {
    if (path === "/login") {
      return <Navigate to="/admin/login" replace />;
    }
    if (path === "/register") {
      return <Navigate to="/admin/register" replace />;
    }
  }

  if (portal === "vendor") {
    if (path === "/admin/login" || path === "/customer/login") {
      return <Navigate to="/login" replace />;
    }
  }

  if (portal === "customer") {
    if (path === "/login") {
      return <Navigate to="/customer/login" replace />;
    }
    if (path === "/register") {
      return <Navigate to="/customer/register" replace />;
    }
    if (path === "/admin/login") {
      return <Navigate to="/customer/login" replace />;
    }
  }

  return <>{children}</>;
}
