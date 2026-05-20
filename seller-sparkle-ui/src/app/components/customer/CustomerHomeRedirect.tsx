import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";

/** Guests land on Browse; signed-in customers land on Dashboard (matches Lovable /customer vs /customer/browse). */
function CustomerHomeRedirect() {
  const { user } = useAuth();
  if (user?.role === "customer") return <Navigate to="/customer/dashboard" replace />;
  return <Navigate to="/customer/browse" replace />;
}

export default CustomerHomeRedirect;
