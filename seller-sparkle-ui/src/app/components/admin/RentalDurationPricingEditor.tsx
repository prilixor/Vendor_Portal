import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, PencilLine } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type {
  ProductRentalPricingPlanDto,
  RentalDiscountType,
  RentalDurationMasterDto,
} from "../../services/adminApi";

function computeFinalPrice(normalPrice: number, discountType: RentalDiscountType, discountValue: number): number {
  const normal = Math.max(0, normalPrice || 0);
  const value = Math.max(0, discountValue || 0);
  if (discountType === "fixed") return Math.max(0, Math.round((normal - value) * 100) / 100);
  if (discountType === "percentage") {
    const pct = Math.min(100, value);
    return Math.max(0, Math.round(normal * (1 - pct / 100) * 100) / 100);
  }
  return Math.round(normal * 100) / 100;
}

function formatMoney(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function buildPlansFromMasters(
  masters: RentalDurationMasterDto[],
  dailyRate: number,
  existing: ProductRentalPricingPlanDto[],
): ProductRentalPricingPlanDto[] {
  const rate = Math.max(0, dailyRate || 0);
  return masters.map((master, index) => {
    const prior =
      existing.find((p) => p.rentalDurationMasterId === master.id) ||
      existing.find((p) => p.durationDays === master.durationDays);
    const normalPrice = Math.round(rate * master.durationDays * 100) / 100;
    const discountType = (prior?.discountType ?? "none") as RentalDiscountType;
    const discountValue = prior?.discountValue ?? 0;
    return {
      id: prior?.id || "",
      productId: prior?.productId || "",
      rentalDurationMasterId: master.id,
      durationLabel: master.durationLabel,
      durationDays: master.durationDays,
      normalPrice,
      discountType,
      discountValue,
      finalRentalPrice: computeFinalPrice(normalPrice, discountType, discountValue),
      isRecommended: prior?.isRecommended ?? false,
      isActive: prior?.isActive ?? true,
      sortOrder: master.sortOrder ?? index,
    };
  });
}

type Props = {
  dailyRate: number;
  hideDailyRateInput?: boolean;
  onDailyRateChange?: (rate: number) => void;
  masters: RentalDurationMasterDto[];
  plans: ProductRentalPricingPlanDto[];
  onChange: (plans: ProductRentalPricingPlanDto[]) => void;
  disabled?: boolean;
};

export function RentalDurationPricingEditor({
  dailyRate,
  hideDailyRateInput = false,
  onDailyRateChange,
  masters,
  plans,
  onChange,
  disabled,
}: Props) {
  const [chartOpen, setChartOpen] = useState(false);

  const activeMasters = useMemo(
    () =>
      masters
        .filter((m) => m.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.durationDays - b.durationDays),
    [masters],
  );

  useEffect(() => {
    if (activeMasters.length === 0) return;
    const next = buildPlansFromMasters(activeMasters, dailyRate, plans);
    const changed =
      next.length !== plans.length ||
      next.some((n, i) => {
        const p = plans[i];
        return (
          !p ||
          p.rentalDurationMasterId !== n.rentalDurationMasterId ||
          p.durationLabel !== n.durationLabel ||
          p.durationDays !== n.durationDays ||
          p.normalPrice !== n.normalPrice ||
          p.finalRentalPrice !== n.finalRentalPrice ||
          p.sortOrder !== n.sortOrder
        );
      });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMasters, dailyRate]);

  const updatePlan = (index: number, patch: Partial<ProductRentalPricingPlanDto>) => {
    const next = [...plans];
    const current = { ...next[index], ...patch };
    const normal =
      patch.normalPrice != null
        ? current.normalPrice
        : Math.round(Math.max(0, dailyRate || 0) * current.durationDays * 100) / 100;
    current.normalPrice = normal;
    current.finalRentalPrice = computeFinalPrice(
      current.normalPrice,
      current.discountType,
      current.discountValue,
    );
    if (patch.isRecommended === true) {
      next.forEach((p, i) => {
        if (i !== index) next[i] = { ...p, isRecommended: false };
      });
    }
    next[index] = current;
    onChange(next);
  };

  const offeredPlans = plans.filter((p) => p.isActive && p.finalRentalPrice > 0);
  const bestPlan = offeredPlans.find((p) => p.isRecommended);
  const priceFrom = offeredPlans.length
    ? Math.min(...offeredPlans.map((p) => p.finalRentalPrice))
    : 0;
  const priceTo = offeredPlans.length
    ? Math.max(...offeredPlans.map((p) => p.finalRentalPrice))
    : 0;
  const canOpenChart = dailyRate > 0 && activeMasters.length > 0;

  return (
    <>
      {!hideDailyRateInput && (
        <div className="space-y-1.5">
          <Label required>Daily rate (INR)</Label>
          <Input
            type="number"
            min={0}
            value={dailyRate}
            onChange={(e) => onDailyRateChange?.(Number(e.target.value) || 0)}
            disabled={disabled}
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Duration price chart</h4>
              <p className="text-xs text-muted-foreground">
                Configure discounts and which durations customers can choose.
              </p>
              {canOpenChart ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="font-normal">
                    {offeredPlans.length} of {plans.length} offered
                  </Badge>
                  {offeredPlans.length > 0 && (
                    <Badge variant="outline" className="font-mono font-normal">
                      {priceFrom === priceTo
                        ? formatMoney(priceFrom)
                        : `${formatMoney(priceFrom)} – ${formatMoney(priceTo)}`}
                    </Badge>
                  )}
                  {bestPlan && (
                    <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200 font-normal">
                      Best: {bestPlan.durationLabel}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                  {activeMasters.length === 0
                    ? "Add durations in Rental Duration Master first."
                    : "Enter a daily rate to enable the chart."}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={disabled || !canOpenChart}
            onClick={() => setChartOpen(true)}
          >
            <PencilLine className="mr-2 h-4 w-4" />
            Configure prices
          </Button>
        </div>
      </div>

      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent
          className="flex z-[60] max-h-[min(92dvh,880px)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          overlayClassName="z-[60]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 pr-12 text-left sm:px-6">
            <DialogTitle>Duration price chart</DialogTitle>
            <p className="text-sm text-muted-foreground">
              List price = daily rate × days. Set discounts; customers see the final amount.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono">
                Daily rate {formatMoney(dailyRate)}
              </span>
              <span>
                Durations from{" "}
                <Link
                  to="/admin/rental-durations"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setChartOpen(false)}
                >
                  Rental Duration Master
                </Link>
              </span>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto px-0 py-0">
            {plans.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No duration rows available.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-semibold sm:px-6">Duration</th>
                    <th className="px-3 py-3 font-semibold text-right">List price</th>
                    <th className="px-3 py-3 font-semibold">Discount</th>
                    <th className="px-3 py-3 font-semibold text-right">Customer pays</th>
                    <th className="px-3 py-3 font-semibold text-center">Best value</th>
                    <th className="px-5 py-3 font-semibold text-center sm:px-6">Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan, index) => {
                    const hasDiscount = plan.discountType !== "none" && plan.discountValue > 0;
                    return (
                      <tr
                        key={plan.rentalDurationMasterId || plan.id || index}
                        className={`border-b border-border/70 last:border-0 ${
                          !plan.isActive ? "bg-muted/20 opacity-60" : "bg-background"
                        } ${plan.isRecommended && plan.isActive ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                      >
                        <td className="px-5 py-3.5 align-middle sm:px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{plan.durationLabel}</span>
                            {plan.isRecommended && plan.isActive && (
                              <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200 text-[10px] font-medium">
                                Best
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground font-mono">
                            {formatMoney(dailyRate)} × {plan.durationDays} days
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle text-right font-mono tabular-nums text-muted-foreground">
                          {formatMoney(plan.normalPrice)}
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="flex items-center gap-2">
                            <Select
                              value={plan.discountType}
                              onValueChange={(v) =>
                                updatePlan(index, {
                                  discountType: v as RentalDiscountType,
                                  discountValue: v === "none" ? 0 : plan.discountValue,
                                })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-9 w-[108px]">
                                <SelectValue />
                              </SelectTrigger>
                              {/* Above nested Dialog (z-60) so items are clickable */}
                              <SelectContent className="z-[70]">
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="fixed">Fixed ₹</SelectItem>
                                <SelectItem value="percentage">Percent %</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              className="h-9 w-[88px]"
                              value={plan.discountType === "none" ? "" : plan.discountValue}
                              placeholder="0"
                              disabled={disabled || plan.discountType === "none"}
                              onChange={(e) =>
                                updatePlan(index, { discountValue: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-middle text-right">
                          <div className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {formatMoney(plan.finalRentalPrice)}
                          </div>
                          {hasDiscount && (
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                              Save {formatMoney(plan.normalPrice - plan.finalRentalPrice)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3.5 align-middle">
                          <div className="flex justify-center">
                            <Switch
                              checked={plan.isRecommended}
                              disabled={disabled || !plan.isActive}
                              onCheckedChange={(checked) =>
                                updatePlan(index, { isRecommended: checked })
                              }
                              aria-label={`Best value for ${plan.durationLabel}`}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 align-middle sm:px-6">
                          <div className="flex justify-center">
                            <Switch
                              checked={plan.isActive}
                              disabled={disabled}
                              onCheckedChange={(checked) =>
                                updatePlan(index, {
                                  isActive: checked,
                                  isRecommended: checked ? plan.isRecommended : false,
                                })
                              }
                              aria-label={`Offer ${plan.durationLabel}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-background px-5 py-3 sm:px-6 sm:justify-between">
            <p className="text-xs text-muted-foreground self-center">
              Changes apply when you save the product.
            </p>
            <Button type="button" onClick={() => setChartOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
