import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Role, User } from "@/app/models";
import { authApi } from "@/app/services/authApi";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import {
  ADMIN_USER_KEY,
  PORTAL_USER_KEY,
  clearAdminSession,
  clearImpersonationSession,
  clearPortalSession,
  ensureAdminTokenMigrated,
  isAdminPath,
  readImpersonationUser,
  setAdminAccessToken,
} from "@/app/helpers/authSession";

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
    const onAdminRoute = isAdminPath();
    ensureAdminTokenMigrated();
    const impersonationUser = readImpersonationUser<User>();

    if (impersonationUser && !onAdminRoute) {
      setUser({
        ...impersonationUser,
        impersonation: true,
      });
      setIsHydrating(false);
      return;
    }

    const adminRaw = localStorage.getItem(ADMIN_USER_KEY);
    if (adminRaw && (onAdminRoute || !localStorage.getItem(PORTAL_USER_KEY))) {
      try {
        setUser(mapAdminStorage(JSON.parse(adminRaw)));
      } catch {
        localStorage.removeItem(ADMIN_USER_KEY);
      }
    } else {
      const raw = localStorage.getItem(PORTAL_USER_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setUser({
            ...parsed,
            impersonation: !!parsed.impersonation,
          });
        } catch {
          localStorage.removeItem(PORTAL_USER_KEY);
        }
      }
    }
    setIsHydrating(false);
  }, []);

  const logout = () => {
    // Impersonation is tab-scoped — never wipe the admin session in other tabs.
    if (readImpersonationUser() && !isAdminPath()) {
      clearImpersonationSession();
      setUser(null);
      return;
    }

    authApi.logout();
    persist(null);
    if (isAdminPath()) {
      clearAdminSession();
    }
    clearPortalSession();
    clearImpersonationSession();
    // Re-prompt location on next login if they still have no delivery address.
    sessionStorage.removeItem("locationPromptSnoozed");
    sessionStorage.removeItem("locationPromptDismissed");
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      const wasImpersonating = !!readImpersonationUser() && !isAdminPath();
      logout();
      const path = window.location.pathname;
      if (wasImpersonating) {
        window.location.href = path.startsWith("/customer")
          ? "/admin/customers"
          : "/admin/vendors";
        return;
      }
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
    if (u) localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(PORTAL_USER_KEY);
    setUser(u);
  };

  const setSessionUser = (u: User | null) => {
    if (u?.role === "admin") {
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify({
        id: u.id,
        email: u.email,
        fullName: u.name,
        name: u.name,
        role: u.adminRole || "admin",
        adminRole: u.adminRole,
        permissions: u.permissions ?? [],
      }));
      localStorage.removeItem(PORTAL_USER_KEY);
      setUser(u);
      return;
    }
    persist(u);
  };

  const login = async (email: string, password: string, role: Role) => {
    const result = await authApi.login(email, password, role);
    if (role === "admin") {
      setAdminAccessToken(result.token);
      setSessionUser(result.user);
      return;
    }
    clearImpersonationSession();
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
