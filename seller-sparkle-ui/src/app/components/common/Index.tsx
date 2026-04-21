import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/guards/AuthContext";

const Index = () => {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/vendor"} replace />;
};

export default Index;


