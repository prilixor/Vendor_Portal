import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  DEFAULT_UI_RENTAL_UNIT,
  estimateRent,
  normalizeRentalUnit,
  type RentalPeriodUnit,
} from "@/app/helpers/rentalPeriod";

const CART_KEY = "customer_portal_cart_v2";

export interface CartLine {
  listingId: string;
  title: string;
  vendorName: string;
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  primaryImageUrl?: string | null;
  quantity: number;
  /** Period count for rentalPeriodUnit. */
  rentalDays: number;
  rentalPeriodUnit: RentalPeriodUnit;
  orderType: "rent" | "buy";
  prescriptionRequired?: boolean;
  productVariantId?: string;
  buyPrice?: number;
}

interface CartContextValue {
  lines: CartLine[];
  addLine: (
    line: Omit<CartLine, "quantity" | "rentalDays" | "rentalPeriodUnit"> & {
      quantity?: number;
      rentalDays?: number;
      rentalPeriodUnit?: RentalPeriodUnit;
    },
  ) => void;
  updateLine: (
    listingId: string,
    patch: Partial<Pick<CartLine, "quantity" | "rentalDays" | "rentalPeriodUnit" | "orderType">>,
  ) => void;
  removeLine: (listingId: string) => void;
  clear: () => void;
  totalEstimatedRent: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY) ?? localStorage.getItem("customer_portal_cart_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l) => ({
      ...l,
      weeklyRent: l.weeklyRent ?? 0,
      orderType: l.orderType === "buy" ? "buy" : "rent",
      rentalPeriodUnit: normalizeRentalUnit(l.rentalPeriodUnit) || DEFAULT_UI_RENTAL_UNIT,
      rentalDays: l.orderType === "buy" ? 0 : Math.max(1, l.rentalDays || 1),
    }));
  } catch {
    return [];
  }
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [lines, setLines] = useState<CartLine[]>(() => loadCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines]);

  const addLine = useCallback(
    (
      line: Omit<CartLine, "quantity" | "rentalDays" | "rentalPeriodUnit"> & {
        quantity?: number;
        rentalDays?: number;
        rentalPeriodUnit?: RentalPeriodUnit;
      },
    ) => {
      const qty = line.quantity ?? 1;
      const orderType = line.orderType ?? "rent";
      const unit = orderType === "buy" ? "day" : normalizeRentalUnit(line.rentalPeriodUnit || DEFAULT_UI_RENTAL_UNIT);
      const periods = orderType === "buy" ? 0 : (line.rentalDays ?? 1);
      setLines((prev) => {
        const ix = prev.findIndex((l) => l.listingId === line.listingId && l.productVariantId === line.productVariantId);
        if (ix >= 0) {
          const next = [...prev];
          next[ix] = {
            ...next[ix],
            quantity: next[ix].quantity + qty,
            rentalDays: periods,
            rentalPeriodUnit: unit,
            title: line.title,
            vendorName: line.vendorName,
            dailyRent: line.dailyRent,
            weeklyRent: line.weeklyRent ?? 0,
            monthlyRent: line.monthlyRent,
            securityDeposit: line.securityDeposit,
            primaryImageUrl: line.primaryImageUrl,
            orderType,
            prescriptionRequired: line.prescriptionRequired ?? next[ix].prescriptionRequired,
            buyPrice: line.buyPrice,
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
            weeklyRent: line.weeklyRent ?? 0,
            monthlyRent: line.monthlyRent,
            securityDeposit: line.securityDeposit,
            primaryImageUrl: line.primaryImageUrl,
            quantity: qty,
            rentalDays: periods,
            rentalPeriodUnit: unit,
            orderType,
            prescriptionRequired: line.prescriptionRequired,
            productVariantId: line.productVariantId,
            buyPrice: line.buyPrice,
          },
        ];
      });
    },
    [],
  );

  const updateLine = useCallback(
    (
      listingId: string,
      patch: Partial<Pick<CartLine, "quantity" | "rentalDays" | "rentalPeriodUnit" | "orderType">>,
    ) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.listingId !== listingId) return l;
          const next = { ...l, ...patch };
          if (next.orderType === "buy") {
            next.rentalDays = 0;
          } else if (next.rentalDays <= 0) {
            next.rentalDays = 1;
          }
          if (patch.rentalPeriodUnit) {
            next.rentalPeriodUnit = normalizeRentalUnit(patch.rentalPeriodUnit);
          }
          return next;
        }),
      );
    },
    [],
  );

  const removeLine = useCallback((listingId: string) => {
    setLines((prev) => prev.filter((l) => l.listingId !== listingId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalEstimatedRent = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const buyPrice = l.buyPrice ?? l.dailyRent * 30;
        if (l.orderType === "buy") return sum + buyPrice * l.quantity;
        return (
          sum +
          estimateRent(l.rentalPeriodUnit, l.rentalDays, l.quantity, {
            dailyRent: l.dailyRent,
            weeklyRent: l.weeklyRent,
            monthlyRent: l.monthlyRent,
          })
        );
      }, 0),
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
