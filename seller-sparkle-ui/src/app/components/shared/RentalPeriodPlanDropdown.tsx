import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Star, Tag } from "lucide-react";
import type { RentalPricingPlanDto } from "@/app/services/customerApi";
import { cn } from "@/app/helpers/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  dayPlanTitle,
  formatBillingCycles,
  rentalValueTierLabel,
  resolveRentalIconUrl,
} from "@/app/helpers/rentalDurationIcons";

export function formatPlanInr(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Old price with diagonal strike (left-bottom → right-top). */
export function StruckPrice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("strike-diagonal font-semibold tabular-nums text-rose-400", className)}>
      {children}
    </span>
  );
}

export function planSavings(plan: RentalPricingPlanDto): number {
  return Math.max(0, Number(plan.normalPrice || 0) - Number(plan.finalRentalPrice || 0));
}

export function planDiscountPercent(plan: RentalPricingPlanDto): number {
  const normal = Number(plan.normalPrice || 0);
  const final = Number(plan.finalRentalPrice || 0);
  if (!(normal > 0) || final >= normal) return 0;
  if (plan.discountType === "percentage" && plan.discountValue > 0) {
    return Math.min(100, Math.round(plan.discountValue));
  }
  return Math.min(100, Math.round(((normal - final) / normal) * 100));
}

function planBillingCycles(plan: RentalPricingPlanDto): number {
  if (plan.billingCycles && plan.billingCycles > 0) return Number(plan.billingCycles);
  if (plan.durationDays > 0) return Math.round((plan.durationDays / 28) * 100) / 100;
  return 0;
}

function planPerDay(plan: RentalPricingPlanDto): number | null {
  const days = Number(plan.durationDays || 0);
  const price = Number(plan.finalRentalPrice || 0);
  if (!(days > 0) || !(price > 0)) return null;
  return Math.round(price / days);
}

/** Active plans sorted: Most Popular first, then longest → shortest. */
export function sortActiveRentalPlans(plans: RentalPricingPlanDto[] | null | undefined): RentalPricingPlanDto[] {
  return (plans ?? [])
    .filter((p) => p.isActive)
    .slice()
    .sort((a, b) => {
      if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
      return b.durationDays - a.durationDays || a.sortOrder - b.sortOrder;
    });
}

/**
 * On-page rental plan dropdown (shared by Customer PDP and Admin place-order).
 * No modal — popover list anchored to the trigger.
 */
export function RentalPeriodPlanDropdown({
  plans,
  selectedPlanId,
  onSelect,
}: {
  plans: RentalPricingPlanDto[];
  selectedPlanId: string;
  onSelect: (plan: RentalPricingPlanDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  const legend = useMemo(() => {
    const order = ["good", "better", "best_value", "maximum_savings"];
    const byTier = new Map<string, { url: string; label: string }>();

    for (const plan of plans) {
      const tier = (plan.valueTier || "").toLowerCase().replace(/-/g, "_");
      const raw = plan.iconUrl || plan.iconThumbnailUrl;
      if (!tier || !raw || byTier.has(tier)) continue;
      byTier.set(tier, {
        label: rentalValueTierLabel(tier),
        url: resolveRentalIconUrl(raw),
      });
    }

    return order
      .filter((t) => byTier.has(t))
      .map((tier) => ({ tier, ...byTier.get(tier)! }));
  }, [plans]);

  const bestSavingsPlanId = useMemo(() => {
    let bestId = "";
    let bestPct = -1;
    for (const plan of plans) {
      const pct = planDiscountPercent(plan);
      if (pct > bestPct) {
        bestPct = pct;
        bestId = plan.id;
      }
    }
    return bestPct > 0 ? bestId : "";
  }, [plans]);

  if (!selected) return null;

  const selectedSavings = planSavings(selected);
  const selectedPctOff = planDiscountPercent(selected);
  const selectedCycles = formatBillingCycles(planBillingCycles(selected));
  const selectedIconUrl = resolveRentalIconUrl(selected.iconUrl || selected.iconThumbnailUrl);
  const selectedTitle = dayPlanTitle(selected.durationDays, selected.durationLabel);
  const selectedTierLabel = rentalValueTierLabel(selected.valueTier);
  const selectedPerDay = planPerDay(selected);
  const selectedIsBestDeal = selected.id === bestSavingsPlanId && selectedPctOff > 0;

  const handlePick = (plan: RentalPricingPlanDto) => {
    onSelect(plan);
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-slate-900">Rental period</h3>
          <p className="mt-0.5 text-[13px] font-medium text-violet-600">More days, more savings</p>
        </div>
        {legend.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {legend.map((item) => (
              <div
                key={item.tier}
                className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 ring-1 ring-inset ring-slate-200/80"
                title={item.label}
              >
                <img src={item.url} alt="" className="h-5 w-5 object-contain" />
                <span className="text-[11px] font-semibold text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            className={cn(
              "group relative w-full overflow-hidden rounded-2xl border-2 bg-white p-3.5 text-left shadow-sm transition-all",
              "hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15",
              open
                ? selected.isRecommended
                  ? "border-blue-500 ring-4 ring-blue-500/10"
                  : "border-violet-500 ring-4 ring-violet-500/10"
                : selected.isRecommended
                  ? "border-blue-400"
                  : "border-slate-200 hover:border-violet-300",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-[15px] font-bold tracking-tight text-slate-900">
                    {selectedTitle}
                  </p>
                  {selected.isRecommended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Most Popular
                    </span>
                  ) : null}
                  {selectedIsBestDeal ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                      Best deal
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  {selected.durationDays} days
                  {selectedCycles ? ` · ${selectedCycles}` : ""}
                  {selectedPerDay != null ? ` · ${formatPlanInr(selectedPerDay)}/day` : ""}
                </p>
                {(selectedPctOff > 0 || selectedSavings > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {selectedPctOff > 0 ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                        {selectedPctOff}% OFF
                      </span>
                    ) : null}
                    {selectedSavings > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700">
                        <Tag className="h-3 w-3" />
                        Save {formatPlanInr(selectedSavings)}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p
                    className={cn(
                      "text-[18px] font-extrabold leading-none tabular-nums",
                      selected.isRecommended ? "text-blue-600" : "text-slate-900",
                    )}
                  >
                    {formatPlanInr(selected.finalRentalPrice)}
                  </p>
                  {selectedSavings > 0 ? (
                    <StruckPrice className="mt-1 block text-[12px]">
                      {formatPlanInr(selected.normalPrice)}
                    </StruckPrice>
                  ) : null}
                </div>
                {selectedIconUrl ? (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 ring-1 ring-inset ring-slate-200"
                    title={selectedTierLabel}
                  >
                    <img
                      src={selectedIconUrl}
                      alt={selectedTierLabel}
                      className="h-9 w-9 object-contain drop-shadow-sm"
                    />
                  </div>
                ) : null}
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                    open && "rotate-180 text-violet-500",
                  )}
                />
              </div>
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[--radix-popover-trigger-width] max-w-none overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl shadow-slate-900/10"
        >
          <div className="border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
            <p className="text-[12px] font-semibold text-slate-600">Choose a rental plan</p>
          </div>

          <div
            role="radiogroup"
            aria-label="Rental period options"
            className="max-h-[min(50dvh,22rem)] space-y-1.5 overflow-y-auto p-2"
          >
            {plans.map((plan) => {
              const isActive = plan.id === selected.id;
              const savings = planSavings(plan);
              const pctOff = planDiscountPercent(plan);
              const cyclesLabel = formatBillingCycles(planBillingCycles(plan));
              const iconUrl = resolveRentalIconUrl(plan.iconUrl || plan.iconThumbnailUrl);
              const title = dayPlanTitle(plan.durationDays, plan.durationLabel);
              const tierLabel = rentalValueTierLabel(plan.valueTier);
              const perDay = planPerDay(plan);
              const isBestDeal = plan.id === bestSavingsPlanId && pctOff > 0;

              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => handlePick(plan)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/15",
                    isActive
                      ? plan.isRecommended
                        ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-200"
                        : "border-violet-500 bg-violet-50/70 ring-1 ring-violet-200"
                      : plan.isRecommended
                        ? "border-blue-200 bg-blue-50/20 hover:border-blue-300"
                        : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2",
                      isActive
                        ? plan.isRecommended
                          ? "border-blue-600 bg-blue-600"
                          : "border-violet-500 bg-violet-500"
                        : "border-slate-300 bg-white",
                    )}
                  >
                    {isActive ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-bold text-slate-900">{title}</p>
                      {plan.isRecommended ? (
                        <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          Most Popular
                        </span>
                      ) : null}
                      {isBestDeal ? (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                          Best deal
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                      {plan.durationDays} days
                      {perDay != null ? ` · ${formatPlanInr(perDay)}/day` : ""}
                      {cyclesLabel ? ` · ${cyclesLabel}` : ""}
                    </p>
                    {savings > 0 ? (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                        {pctOff > 0 ? `${pctOff}% off · ` : null}
                        Save {formatPlanInr(savings)}
                      </span>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-[15px] font-extrabold tabular-nums",
                        plan.isRecommended ? "text-blue-600" : "text-slate-900",
                      )}
                    >
                      {formatPlanInr(plan.finalRentalPrice)}
                    </p>
                    {savings > 0 ? (
                      <StruckPrice className="mt-1 block text-[11px]">
                        {formatPlanInr(plan.normalPrice)}
                      </StruckPrice>
                    ) : null}
                  </div>

                  {iconUrl ? (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-inset ring-slate-200"
                      title={tierLabel}
                    >
                      <img
                        src={iconUrl}
                        alt={tierLabel}
                        className="h-9 w-9 object-contain drop-shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 shrink-0" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
