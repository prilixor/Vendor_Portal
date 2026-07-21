import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Role, User } from "@/app/models";
import { authApi } from "@/app/services/authApi";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

interface AuthContextValue {
  user: User | null;
  isHydrating: boolean;
  login: (email: string, password: string, role: Role) => Promise<void>;
  register: (email: string, password: string, phone: string) => Promise<{ id: string; email: string }>;
  registerCustomer: (email: string, password: string, fullName: string, phone?: string) => Promise<{ id: string; email: string; fullName: string }>;
  logout: () => void;
  switchRole: (role: Role) => void;
  hasPermission: (permission: string) => boolean;
  setSessionUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "vendor_portal_user";
const ADMIN_STORAGE_KEY = "adminUser";

function mapAdminStorage(adminUser: Record<string, unknown>): User {
  return {
    id: String(adminUser.id ?? ""),
    email: String(adminUser.email ?? ""),
    name: String(adminUser.fullName || adminUser.name || "Admin"),
    role: "admin",
    adminRole: adminUser.adminRole ? String(adminUser.adminRole) : (adminUser.role && adminUser.role !== "admin" ? String(adminUser.role) : undefined),
    permissions: Array.isArray(adminUser.permissions) ? (adminUser.permissions as string[]) : [],
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const adminRaw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (adminRaw) {
      try {
        setUser(mapAdminStorage(JSON.parse(adminRaw)));
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setUser({
            ...parsed,
            impersonation: !!parsed.impersonation || !!localStorage.getItem("impersonation_meta"),
          });
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    setIsHydrating(false);
  }, []);

  const logout = () => {
    authApi.logout();
    persist(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem("vendor_portal_token");
    localStorage.removeItem("impersonation_meta");
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      const path = window.location.pathname;
      if (path.startsWith("/admin")) {
        window.location.href = "/admin/login";
      } else if (path.startsWith("/customer")) {
        window.location.href = "/customer/login";
      } else {
        window.location.href = "/login";
      }
    };

    window.addEventListener("unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
    };
  }, []);

  const persist = (u: User | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

  const setSessionUser = (u: User | null) => {
    if (u?.role === "admin") {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
        id: u.id,
        email: u.email,
        fullName: u.name,
        name: u.name,
        role: u.adminRole || "admin",
        adminRole: u.adminRole,
        permissions: u.permissions ?? [],
      }));
      localStorage.removeItem(STORAGE_KEY);
      setUser(u);
      return;
    }
    persist(u);
  };

  const login = async (email: string, password: string, role: Role) => {
    const result = await authApi.login(email, password, role);
    persist(result.user);
  };

  const register = async (email: string, password: string, phone: string) => {
    const result = await authApi.registerVendor(email, password, phone);
    try {
      await vendorOnboardingApi.upsertVendorNotificationPreference(result.id, {
        vendorId: result.id,
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        newOrderNotifications: true,
      });
    } catch (error) {
      console.error("Failed to set notification preferences:", error);
    }
    return result;
  };

  const registerCustomer = async (email: string, password: string, fullName: string, phone?: string) => {
    return authApi.registerCustomer(email, password, fullName, phone);
  };

  const switchRole = (role: Role) => {
    if (!user) return;
    persist({
      ...user,
      role,
      name: role === "admin" ? "Anita Desai" : "Priya Sharma",
      id: role === "admin" ? "a1" : "v1",
    });
  };

  const hasPermission = (permission: string) => {
    if (!user || user.role !== "admin") return false;
    if (user.adminRole === "super_admin") return true;
    const perms = user.permissions ?? [];
    if (perms.length === 0) return true;
    return perms.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, isHydrating, login, register, registerCustomer, logout, switchRole, hasPermission, setSessionUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
