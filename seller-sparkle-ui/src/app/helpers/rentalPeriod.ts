/**
 * Rental period units. Daily remains fully supported in API/types/pricing.
 * Toggle UI visibility here when the client wants Daily shown again.
 */
export type RentalPeriodUnit = "day" | "week" | "month";

/** Units shown in Admin / Vendor / Customer UI. Add "day" to re-enable Daily. */
export const RENTAL_UNITS_VISIBLE_IN_UI: RentalPeriodUnit[] = ["week", "month"];

export const RENTAL_UNIT_LABELS: Record<RentalPeriodUnit, { singular: string; plural: string; short: string; per: string }> = {
  day: { singular: "Day", plural: "Days", short: "d", per: "/day" },
  week: { singular: "Week", plural: "Weeks", short: "w", per: "/week" },
  month: { singular: "Month", plural: "Months", short: "mo", per: "/month" },
};

export const DEFAULT_UI_RENTAL_UNIT: RentalPeriodUnit =
  RENTAL_UNITS_VISIBLE_IN_UI.includes("week") ? "week" : RENTAL_UNITS_VISIBLE_IN_UI[0] ?? "week";

export function isRentalUnitVisible(unit: RentalPeriodUnit): boolean {
  return RENTAL_UNITS_VISIBLE_IN_UI.includes(unit);
}

export function normalizeRentalUnit(unit?: string | null): RentalPeriodUnit {
  const u = (unit || "day").toLowerCase();
  if (u === "week" || u === "month" || u === "day") return u;
  return "day";
}

export function formatRentalDuration(count: number, unit?: string | null): string {
  const u = normalizeRentalUnit(unit);
  const labels = RENTAL_UNIT_LABELS[u];
  const n = Math.max(0, count || 0);
  return `${n} ${n === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase()}`;
}

export function rateForUnit(
  unit: RentalPeriodUnit,
  rates: { dailyRent?: number; weeklyRent?: number; monthlyRent?: number },
): number {
  if (unit === "week") return rates.weeklyRent ?? 0;
  if (unit === "month") return rates.monthlyRent ?? 0;
  return rates.dailyRent ?? 0;
}

export function estimateRent(
  unit: RentalPeriodUnit,
  periods: number,
  quantity: number,
  rates: { dailyRent?: number; weeklyRent?: number; monthlyRent?: number },
): number {
  return rateForUnit(unit, rates) * Math.max(1, periods) * Math.max(1, quantity);
}

export type RentVsBuyCheck = {
  /** True when Buy is offered and rental total meets or exceeds buy total. */
  shouldForceBuy: boolean;
  rentalTotal: number;
  buyTotal: number;
  durationLabel: string;
};

/**
 * When Buy is enabled and rent ≥ buy price, the order should switch to Buy.
 * If Buy is disabled (rent-only), never force Buy — rental continues.
 * Example: buy ₹10,000 · weekly ₹1,000 · 10 weeks → force Buy (only if isBuyEnabled).
 */
export function evaluateRentVsBuy(params: {
  buyPrice?: number | null;
  /** Admin "Buy enabled" — required for force-buy. */
  isBuyEnabled?: boolean | null;
  quantity: number;
  periods: number;
  unit: RentalPeriodUnit;
  rates: { dailyRent?: number; weeklyRent?: number; monthlyRent?: number };
  /** Optional plan-based rental total (overrides estimateRent). */
  planFinalPrice?: number | null;
  planDurationLabel?: string | null;
}): RentVsBuyCheck {
  const qty = Math.max(1, params.quantity || 1);
  const periods = Math.max(1, params.periods || 1);
  const unitBuy = params.buyPrice ?? 0;
  const buyTotal = unitBuy > 0 ? unitBuy * qty : 0;
  const rentalTotal =
    params.planFinalPrice != null && params.planFinalPrice > 0
      ? Number(params.planFinalPrice) * qty
      : estimateRent(params.unit, periods, qty, params.rates);
  const durationLabel =
    params.planDurationLabel?.trim() || formatRentalDuration(periods, params.unit);
  const buyOffered = params.isBuyEnabled === true;
  return {
    shouldForceBuy: buyOffered && buyTotal > 0 && rentalTotal >= buyTotal,
    rentalTotal,
    buyTotal,
    durationLabel,
  };
}

/** Primary display rate for browse cards (first visible unit with a positive price). */
export function primaryDisplayRate(rates: {
  dailyRent?: number;
  weeklyRent?: number;
  monthlyRent?: number;
}): { value: number; unit: RentalPeriodUnit } | null {
  for (const unit of RENTAL_UNITS_VISIBLE_IN_UI) {
    const value = rateForUnit(unit, rates);
    if (value > 0) return { value, unit };
  }
  // Fallback to daily if UI-hidden but still set (legacy data)
  if ((rates.dailyRent ?? 0) > 0) return { value: rates.dailyRent!, unit: "day" };
  return null;
}

/** Local calendar date as YYYY-MM-DD. */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add whole days to an ISO date (YYYY-MM-DD). */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatIsoDateDisplay(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Long-term rental plans use durationDays >= this threshold. */
export const LONG_TERM_RENTAL_DAYS = 60;
