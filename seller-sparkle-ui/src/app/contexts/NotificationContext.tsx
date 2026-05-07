import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationContext must be used within NotificationProvider");
  }
  return context;
};

export const NotificationProvider = ({ children, vendorId }: { children: ReactNode; vendorId?: string }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    if (!vendorId) return;
    try {
      const result = await vendorOnboardingApi.getUnreadNotificationCount(vendorId);
      setUnreadCount(result);
    } catch (error) {
      console.error("Failed to refresh unread notification count:", error);
    }
  };

  // Initial load and refresh when vendorId changes
  useEffect(() => {
    if (vendorId) {
      refreshUnreadCount();
    }
  }, [vendorId]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
