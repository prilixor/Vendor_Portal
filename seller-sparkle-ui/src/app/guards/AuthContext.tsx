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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "vendor_portal_user";
const ADMIN_STORAGE_KEY = "adminUser";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    // Try to get admin user first
    const adminRaw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (adminRaw) {
      try {
        const adminUser = JSON.parse(adminRaw);
        setUser({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.fullName || adminUser.name || "Admin",
          role: "admin",
        });
      } catch {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    } else {
      // Fall back to vendor user
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsedUser = JSON.parse(raw);
          setUser(parsedUser);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    setIsHydrating(false);
  }, []);

  const persist = (u: User | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

  const login = async (email: string, password: string, role: Role) => {
    const result = await authApi.login(email, password, role);
    persist(result.user);
    // Vendors can now navigate freely - the pending banner will show on all pages
  };

  const register = async (email: string, password: string, phone: string) => {
    const result = await authApi.registerVendor(email, password, phone);
    
    // Set notification preferences: push OFF by default, email ON
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

  const logout = () => {
    authApi.logout();
    persist(null);
    // Also clear admin user data and token
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem("vendor_portal_token");
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

  return (
    <AuthContext.Provider value={{ user, isHydrating, login, register, registerCustomer, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};


