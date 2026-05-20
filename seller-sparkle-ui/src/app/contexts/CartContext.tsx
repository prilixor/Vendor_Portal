import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

const CART_KEY = "customer_portal_cart_v1";

export interface CartLine {
  listingId: string;
  title: string;
  vendorName: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  primaryImageUrl?: string | null;
  quantity: number;
  rentalDays: number;
}

interface CartContextValue {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, "quantity" | "rentalDays"> & { quantity?: number; rentalDays?: number }) => void;
  updateLine: (listingId: string, patch: Partial<Pick<CartLine, "quantity" | "rentalDays">>) => void;
  removeLine: (listingId: string) => void;
  clear: () => void;
  totalEstimatedRent: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [lines, setLines] = useState<CartLine[]>(() => loadCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines]);

  const addLine = useCallback((line: Omit<CartLine, "quantity" | "rentalDays"> & { quantity?: number; rentalDays?: number }) => {
    const qty = line.quantity ?? 1;
    const days = line.rentalDays ?? 7;
    setLines((prev) => {
      const ix = prev.findIndex((l) => l.listingId === line.listingId);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = {
          ...next[ix],
          quantity: next[ix].quantity + qty,
          rentalDays: days,
          title: line.title,
          vendorName: line.vendorName,
          dailyRent: line.dailyRent,
          monthlyRent: line.monthlyRent,
          securityDeposit: line.securityDeposit,
          primaryImageUrl: line.primaryImageUrl,
        };
        return next;
      }
      return [
        ...prev,
        {
          listingId: line.listingId,
          title: line.title,
          vendorName: line.vendorName,
          dailyRent: line.dailyRent,
          monthlyRent: line.monthlyRent,
          securityDeposit: line.securityDeposit,
          primaryImageUrl: line.primaryImageUrl,
          quantity: qty,
          rentalDays: days,
        },
      ];
    });
  }, []);

  const updateLine = useCallback((listingId: string, patch: Partial<Pick<CartLine, "quantity" | "rentalDays">>) => {
    setLines((prev) =>
      prev.map((l) => (l.listingId === listingId ? { ...l, ...patch } : l)),
    );
  }, []);

  const removeLine = useCallback((listingId: string) => {
    setLines((prev) => prev.filter((l) => l.listingId !== listingId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalEstimatedRent = useMemo(
    () => lines.reduce((sum, l) => sum + l.dailyRent * l.quantity * l.rentalDays, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, addLine, updateLine, removeLine, clear, totalEstimatedRent }),
    [lines, addLine, updateLine, removeLine, clear, totalEstimatedRent],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
