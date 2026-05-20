import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";

const Index = () => {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "customer") return <Navigate to="/customer/dashboard" replace />;
  return <Navigate to="/vendor" replace />;
};

export default Index;


