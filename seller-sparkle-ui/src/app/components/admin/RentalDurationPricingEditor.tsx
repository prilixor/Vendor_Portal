import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ImagePlus, PencilLine, Sparkles } from "lucide-react";
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
  RentalDurationIconDto,
  RentalDurationMasterDto,
} from "../../services/adminApi";
import {
  dayPlanTitle,
  rentalValueTierLabel,
  resolveRentalIconUrl,
} from "@/app/helpers/rentalDurationIcons";
import { cn } from "@/app/helpers/utils";

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

function discountTypeLabel(type: RentalDiscountType): string {
  switch (type) {
    case "percentage":
      return "Percent %";
    case "fixed":
      return "Fixed ₹";
    default:
      return "None";
  }
}

function discountUnit(type: RentalDiscountType): string | null {
  if (type === "percentage") return "%";
  if (type === "fixed") return "₹";
  return null;
}

/** Short label for table meta (avoids wrapping "Billing Cycles"). */
function compactBillingCycles(cycles?: number | null): string {
  const n = Number(cycles ?? 0);
  if (!(n > 0)) return "";
  const text = Number.isInteger(n) ? String(n) : String(n);
  return n === 1 ? "1 cycle" : `${text} cycles`;
}

function tierBadgeClass(tier?: string | null): string {
  const key = (tier ?? "").toLowerCase().replace(/-/g, "_");
  switch (key) {
    case "good":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "better":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "best_value":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
    case "maximum_savings":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "";
  }
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
    const billingCycles =
      master.billingCycles && master.billingCycles > 0
        ? master.billingCycles
        : Math.round((master.durationDays / 28) * 100) / 100;
    return {
      id: prior?.id || "",
      productId: prior?.productId || "",
      rentalDurationMasterId: master.id,
      durationLabel: master.durationLabel,
      durationDays: master.durationDays,
      billingCycles,
      normalPrice,
      discountType,
      discountValue,
      finalRentalPrice: computeFinalPrice(normalPrice, discountType, discountValue),
      isRecommended: prior?.isRecommended ?? false,
      isActive: prior?.isActive ?? true,
      sortOrder: master.sortOrder ?? index,
      rentalDurationIconId: prior?.rentalDurationIconId ?? null,
      iconUrl: prior?.iconUrl ?? null,
      iconThumbnailUrl: prior?.iconThumbnailUrl ?? null,
      valueTier: prior?.valueTier ?? null,
      iconName: prior?.iconName ?? null,
    };
  });
}

type Props = {
  dailyRate: number;
  hideDailyRateInput?: boolean;
  onDailyRateChange?: (rate: number) => void;
  masters: RentalDurationMasterDto[];
  icons: RentalDurationIconDto[];
  plans: ProductRentalPricingPlanDto[];
  onChange: (plans: ProductRentalPricingPlanDto[]) => void;
  disabled?: boolean;
};

export function RentalDurationPricingEditor({
  dailyRate,
  hideDailyRateInput = false,
  onDailyRateChange,
  masters,
  icons,
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

  const activeIcons = useMemo(
    () =>
      icons
        .filter((i) => i.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [icons],
  );

  const planIconPreviewUrl = (plan: {
    rentalDurationIconId?: string | null;
    iconUrl?: string | null;
    iconThumbnailUrl?: string | null;
  }) => {
    const fromCatalog = activeIcons.find((i) => i.id === plan.rentalDurationIconId);
    if (fromCatalog) {
      return resolveRentalIconUrl(fromCatalog.thumbnailUrl || fromCatalog.imageUrl);
    }
    return resolveRentalIconUrl(plan.iconThumbnailUrl || plan.iconUrl);
  };

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
          p.billingCycles !== n.billingCycles ||
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

  const applyIcon = (index: number, iconId: string) => {
    if (iconId === "__none__") {
      updatePlan(index, {
        rentalDurationIconId: null,
        iconUrl: null,
        iconThumbnailUrl: null,
        valueTier: null,
        iconName: null,
      });
      return;
    }
    const icon = activeIcons.find((i) => i.id === iconId);
    if (!icon) return;
    updatePlan(index, {
      rentalDurationIconId: icon.id,
      iconUrl: (icon.imageStorageKey?.trim() || icon.imageUrl || "").trim() || null,
      iconThumbnailUrl: (icon.thumbnailStorageKey?.trim() || icon.thumbnailUrl || "").trim() || null,
      valueTier: icon.valueTier,
      iconName: icon.name,
    });
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

  const renderIconThumb = (src: string | null | undefined, alt = "", size: "sm" | "md" = "md") => {
    const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted/30",
          box,
        )}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-contain p-0.5" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
    );
  };

  const renderPlanMeta = (
    plan: ProductRentalPricingPlanDto,
    extras?: { listPrice?: number; hasDiscount?: boolean },
  ) => {
    const cycles = compactBillingCycles(plan.billingCycles);
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {cycles ? (
          <span className="inline-flex items-center rounded-md border border-violet-200/80 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
            {cycles}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
          <span className="font-semibold text-violet-700 dark:text-violet-300">
            {formatMoney(dailyRate)}
          </span>
          <span className="text-muted-foreground">/day</span>
          <span className="text-border">×</span>
          <span className="font-medium text-foreground">{plan.durationDays}</span>
        </span>
        {extras?.listPrice != null ? (
          extras.hasDiscount ? (
            <span className="strike-diagonal font-mono text-[11px] font-medium tabular-nums text-rose-400 dark:text-rose-400/90">
              {formatMoney(extras.listPrice)}
            </span>
          ) : (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              list {formatMoney(extras.listPrice)}
            </span>
          )
        ) : null}
      </div>
    );
  };

  const renderDiscountControl = (
    plan: ProductRentalPricingPlanDto,
    index: number,
    layout: "desktop" | "mobile" = "desktop",
  ) => {
    const active = plan.discountType !== "none";
    const unit = discountUnit(plan.discountType);
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg border p-1 transition-colors",
          active
            ? "border-amber-300/80 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30"
            : "border-border/70 bg-muted/15",
        )}
      >
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
          <SelectTrigger
            className={cn(
              "h-8 shrink-0 border-0 bg-transparent px-2.5 shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:whitespace-nowrap [&>span]:overflow-visible [&>span]:line-clamp-none [&_svg]:h-3.5 [&_svg]:w-3.5",
              layout === "desktop" ? "w-[128px]" : "min-w-[128px] flex-1",
              active
                ? "font-medium text-amber-900 dark:text-amber-200"
                : "text-muted-foreground",
            )}
          >
            <SelectValue>{discountTypeLabel(plan.discountType)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="percentage">Percent %</SelectItem>
            <SelectItem value="fixed">Fixed ₹</SelectItem>
          </SelectContent>
        </Select>
        <div
          className={cn(
            "flex h-8 items-center gap-1 rounded-md border px-2",
            active
              ? "border-amber-200/80 bg-background dark:border-amber-900"
              : "border-transparent bg-background/60",
            !active && "opacity-50",
          )}
        >
          {unit === "₹" && (
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">₹</span>
          )}
          <Input
            type="number"
            min={0}
            max={plan.discountType === "percentage" ? 100 : undefined}
            className={cn(
              "h-7 border-0 bg-transparent p-0 text-right font-mono text-sm font-semibold tabular-nums shadow-none focus-visible:ring-0",
              layout === "desktop" ? "w-[56px]" : "w-[64px]",
              active
                ? "text-amber-950 dark:text-amber-100"
                : "text-muted-foreground",
            )}
            value={active ? plan.discountValue : ""}
            placeholder="0"
            disabled={disabled || !active}
            onChange={(e) => updatePlan(index, { discountValue: Number(e.target.value) || 0 })}
          />
          {unit === "%" && (
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">%</span>
          )}
        </div>
      </div>
    );
  };

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

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Rental period pricing</h4>
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
                More days, more savings
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
                    <Badge className="bg-blue-500/15 font-normal text-blue-800 hover:bg-blue-500/15 dark:text-blue-200">
                      Most popular: {dayPlanTitle(bestPlan.durationDays, bestPlan.durationLabel)}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="pt-1 text-xs text-amber-700 dark:text-amber-400">
                  {activeMasters.length === 0
                    ? "Add rental durations under Catalog → Rental Setup first."
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
          className="flex z-[60] max-h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
          overlayClassName="z-[60]"
        >
          <DialogHeader className="shrink-0 space-y-3 border-b border-border bg-muted/15 px-5 py-4 pr-12 text-left sm:px-6">
            <div>
              <DialogTitle className="text-lg">Rental period pricing</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-violet-600 dark:text-violet-400">
                  More days, more savings
                </span>
                {" — "}
                list price = daily rate × days
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-border/70 bg-background px-2.5 py-1 font-mono text-xs tabular-nums text-foreground">
                Daily rate {formatMoney(dailyRate)}
              </span>
              <span className="inline-flex items-center rounded-md border border-border/70 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                {plans.length} plans
              </span>
              <span className="text-xs text-muted-foreground">
                Manage{" "}
                <Link
                  to="/admin/rental-setup"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setChartOpen(false)}
                >
                  durations
                </Link>
                {" · "}
                <Link
                  to="/admin/rental-setup?tab=icons"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setChartOpen(false)}
                >
                  icons
                </Link>
              </span>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <CalendarRange className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No rental plans available</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Add rental durations under Catalog → Rental Setup, then reopen this chart.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1040px] text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-left text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/85">
                      <tr>
                        <th className="min-w-[220px] px-5 py-3 font-semibold sm:px-6">Rental plan</th>
                        <th className="px-4 py-3 font-semibold">Icon</th>
                        <th className="px-4 py-3 font-semibold text-right">List price</th>
                        <th className="px-4 py-3 font-semibold">Discount</th>
                        <th className="px-4 py-3 font-semibold text-right">Customer pays</th>
                        <th className="px-4 py-3 font-semibold text-center">Most popular</th>
                        <th className="px-5 py-3 font-semibold text-center sm:px-6">Offer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan, index) => {
                        const hasDiscount = plan.discountType !== "none" && plan.discountValue > 0;
                        const planTitle = dayPlanTitle(plan.durationDays, plan.durationLabel);
                        const preview = planIconPreviewUrl(plan);
                        const selectedIcon = activeIcons.find((i) => i.id === plan.rentalDurationIconId);
                        const popularActive = plan.isRecommended && plan.isActive;

                        return (
                          <tr
                            key={plan.rentalDurationMasterId || plan.id || index}
                            className={cn(
                              "border-b border-border/70 last:border-0 transition-colors",
                              !plan.isActive && "bg-muted/20 opacity-55",
                              popularActive && "bg-blue-50/50 dark:bg-blue-950/20",
                            )}
                          >
                            <td className="min-w-[220px] px-5 py-3.5 align-middle sm:px-6">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[15px] font-semibold tracking-tight text-foreground">
                                  {planTitle}
                                </span>
                                {popularActive && (
                                  <Badge className="gap-1 bg-blue-500/15 text-[10px] font-medium text-blue-800 hover:bg-blue-500/15 dark:text-blue-200">
                                    <Sparkles className="h-3 w-3" />
                                    Most popular
                                  </Badge>
                                )}
                              </div>
                              {renderPlanMeta(plan)}
                            </td>

                            <td className="px-4 py-3.5 align-middle">
                              <Select
                                value={plan.rentalDurationIconId || "__none__"}
                                onValueChange={(v) => applyIcon(index, v)}
                                disabled={disabled || activeIcons.length === 0}
                              >
                                <SelectTrigger className="h-11 w-[230px]">
                                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {renderIconThumb(preview, plan.iconName || "", "md")}
                                    <span className="truncate text-left text-sm">
                                      {selectedIcon
                                        ? selectedIcon.name
                                        : activeIcons.length === 0
                                          ? "Add icons first"
                                          : "No icon"}
                                    </span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent className="z-[70]">
                                  <SelectItem value="__none__">
                                    <span className="text-muted-foreground">No icon</span>
                                  </SelectItem>
                                  {activeIcons.map((icon) => {
                                    const src = resolveRentalIconUrl(icon.thumbnailUrl || icon.imageUrl);
                                    return (
                                      <SelectItem key={icon.id} value={icon.id}>
                                        <div className="flex items-center gap-2">
                                          {renderIconThumb(src, icon.name, "md")}
                                          <span>{icon.name}</span>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "ml-1 text-[10px] font-medium",
                                              tierBadgeClass(icon.valueTier),
                                            )}
                                          >
                                            {rentalValueTierLabel(icon.valueTier)}
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </td>

                            <td className="px-4 py-3.5 align-middle text-right font-mono tabular-nums">
                              {hasDiscount ? (
                                <span className="strike-diagonal font-medium text-rose-400 dark:text-rose-400/90">
                                  {formatMoney(plan.normalPrice)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {formatMoney(plan.normalPrice)}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-middle">
                              {renderDiscountControl(plan, index, "desktop")}
                            </td>

                            <td className="px-4 py-3.5 align-middle text-right">
                              <div
                                className={cn(
                                  "font-mono text-base font-bold tabular-nums",
                                  popularActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-foreground",
                                )}
                              >
                                {formatMoney(plan.finalRentalPrice)}
                              </div>
                              {hasDiscount && (
                                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                  Save {formatMoney(plan.normalPrice - plan.finalRentalPrice)}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={plan.isRecommended}
                                  disabled={disabled || !plan.isActive}
                                  onCheckedChange={(checked) =>
                                    updatePlan(index, { isRecommended: checked })
                                  }
                                  aria-label={`Most popular for ${planTitle}`}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {plan.isRecommended ? "Yes" : "No"}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-3.5 align-middle sm:px-6">
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={plan.isActive}
                                  disabled={disabled}
                                  onCheckedChange={(checked) =>
                                    updatePlan(index, {
                                      isActive: checked,
                                      isRecommended: checked ? plan.isRecommended : false,
                                    })
                                  }
                                  aria-label={`Offer ${planTitle}`}
                                />
                                <span
                                  className={cn(
                                    "text-[10px] font-medium",
                                    plan.isActive
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {plan.isActive ? "On" : "Off"}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Compact / mobile cards */}
                <div className="divide-y divide-border lg:hidden">
                  {plans.map((plan, index) => {
                    const hasDiscount = plan.discountType !== "none" && plan.discountValue > 0;
                    const planTitle = dayPlanTitle(plan.durationDays, plan.durationLabel);
                    const preview = planIconPreviewUrl(plan);
                    const selectedIcon = activeIcons.find((i) => i.id === plan.rentalDurationIconId);
                    const popularActive = plan.isRecommended && plan.isActive;

                    return (
                      <div
                        key={plan.rentalDurationMasterId || plan.id || index}
                        className={cn(
                          "space-y-3 p-4",
                          !plan.isActive && "opacity-55",
                          popularActive && "bg-blue-50/50 dark:bg-blue-950/20",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[15px] font-semibold tracking-tight text-foreground">
                                {planTitle}
                              </p>
                              {popularActive && (
                                <Badge className="gap-1 bg-blue-500/15 text-[10px] font-medium text-blue-800 hover:bg-blue-500/15 dark:text-blue-200">
                                  <Sparkles className="h-3 w-3" />
                                  Most popular
                                </Badge>
                              )}
                            </div>
                            {renderPlanMeta(plan, {
                              listPrice: plan.normalPrice,
                              hasDiscount,
                            })}
                          </div>
                          <div className="text-right">
                            <p
                              className={cn(
                                "font-mono text-base font-bold tabular-nums",
                                popularActive
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-foreground",
                              )}
                            >
                              {formatMoney(plan.finalRentalPrice)}
                            </p>
                            {hasDiscount && (
                              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                Save {formatMoney(plan.normalPrice - plan.finalRentalPrice)}
                              </p>
                            )}
                          </div>
                        </div>

                        <Select
                          value={plan.rentalDurationIconId || "__none__"}
                          onValueChange={(v) => applyIcon(index, v)}
                          disabled={disabled || activeIcons.length === 0}
                        >
                          <SelectTrigger className="h-11">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              {renderIconThumb(preview, plan.iconName || "", "md")}
                              <span className="truncate">
                                {selectedIcon ? selectedIcon.name : "No icon"}
                              </span>
                            </div>
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="__none__">No icon</SelectItem>
                            {activeIcons.map((icon) => (
                              <SelectItem key={icon.id} value={icon.id}>
                                <div className="flex items-center gap-2">
                                  {renderIconThumb(
                                    resolveRentalIconUrl(icon.thumbnailUrl || icon.imageUrl),
                                    icon.name,
                                    "md",
                                  )}
                                  <span>{icon.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {renderDiscountControl(plan, index, "mobile")}

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                            <span className="text-xs text-muted-foreground">Most popular</span>
                            <Switch
                              checked={plan.isRecommended}
                              disabled={disabled || !plan.isActive}
                              onCheckedChange={(checked) =>
                                updatePlan(index, { isRecommended: checked })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                            <span className="text-xs text-muted-foreground">Offer</span>
                            <Switch
                              checked={plan.isActive}
                              disabled={disabled}
                              onCheckedChange={(checked) =>
                                updatePlan(index, {
                                  isActive: checked,
                                  isRecommended: checked ? plan.isRecommended : false,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-3 border-t border-border bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-muted-foreground">Changes apply when you save the product.</p>
            <Button type="button" onClick={() => setChartOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
