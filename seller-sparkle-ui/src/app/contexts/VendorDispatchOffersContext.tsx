import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

function isPendingDispatchOffer(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "pending" || s.includes("awaiting");
}

interface VendorDispatchOffersContextType {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
}

const VendorDispatchOffersContext = createContext<VendorDispatchOffersContextType | undefined>(
  undefined,
);

export const useVendorDispatchOffersContext = () => {
  const context = useContext(VendorDispatchOffersContext);
  if (!context) {
    throw new Error(
      "useVendorDispatchOffersContext must be used within VendorDispatchOffersProvider",
    );
  }
  return context;
};

export const VendorDispatchOffersProvider = ({
  children,
  vendorId,
}: {
  children: ReactNode;
  vendorId?: string;
}) => {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    if (!vendorId) return;
    try {
      const offers = await vendorOnboardingApi.getVendorDispatchOffers(vendorId, { quiet: true });
      const count = offers.filter((o) => isPendingDispatchOffer(o.status)).length;
      setPendingCount(count);
    } catch (error) {
      console.error("Failed to refresh pending order requests:", error);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) {
      refreshPendingCount();
    } else {
      setPendingCount(0);
    }
  }, [vendorId, refreshPendingCount]);

  useEffect(() => {
    if (!vendorId) return;

    const interval = setInterval(() => {
      refreshPendingCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [vendorId, refreshPendingCount]);

  useEffect(() => {
    if (!vendorId) return;

    const handleFocus = () => {
      refreshPendingCount();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [vendorId, refreshPendingCount]);

  return (
    <VendorDispatchOffersContext.Provider value={{ pendingCount, refreshPendingCount }}>
      {children}
    </VendorDispatchOffersContext.Provider>
  );
};
