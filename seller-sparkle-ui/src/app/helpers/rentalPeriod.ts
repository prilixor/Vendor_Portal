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
