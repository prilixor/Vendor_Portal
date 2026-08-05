import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { customerApi, type RentalPricingPlanDto } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { useAuth } from "@/app/guards/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ProductImageGallery } from "@/app/components/shared/ProductImageGallery";
import { RentExceedsBuyDialog } from "@/app/components/shared/RentExceedsBuyDialog";
import { BackLink } from "@/app/components/shared/BackLink";
import {
  RentalPeriodPlanDropdown,
  planDiscountPercent,
  planSavings,
  sortActiveRentalPlans,
} from "@/app/components/shared/RentalPeriodPlanDropdown";
import { toast } from "sonner";
import {
  Check,
  ShoppingBag,
  ShoppingCart,
  CalendarDays,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  DEFAULT_UI_RENTAL_UNIT,
  RENTAL_UNIT_LABELS,
  RENTAL_UNITS_VISIBLE_IN_UI,
  estimateRent,
  evaluateRentVsBuy,
  type RentalPeriodUnit,
} from "@/app/helpers/rentalPeriod";
import { cn } from "@/app/helpers/utils";

function availabilityBadge(status: string, qty: number): { label: string; className: string } {
  const s = status.trim().toLowerCase();
  const listingVisible = s === "available" || s === "low_stock" || s === "out_of_stock";
  if (!listingVisible) {
    return {
      label: "Unavailable",
      className: "border-0 bg-muted text-foreground hover:bg-muted",
    };
  }
  if (s === "out_of_stock" || qty <= 0) {
    return {
      label: "Out of stock",
      className: "border-0 bg-destructive text-white hover:bg-destructive",
    };
  }
  if (qty === 1) {
    return {
      label: "Only 1 left",
      className: "border-0 bg-amber-700 text-white hover:bg-amber-700",
    };
  }
  if (s === "low_stock" || qty <= 3) {
    return {
      label: "Limited stock",
      className: "border-0 bg-amber-600 text-white hover:bg-amber-600",
    };
  }
  return {
    label: "Available",
    className: "border-0 bg-emerald-600 text-white hover:bg-emerald-600",
  };
}

function formatInr(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const CustomerListingDetail = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addLine } = useCart();
  const [qty, setQty] = useState(1);
  const [periods, setPeriods] = useState(1);
  const [periodUnit, setPeriodUnit] = useState<RentalPeriodUnit>(DEFAULT_UI_RENTAL_UNIT);
  const [orderType, setOrderType] = useState<"rent" | "buy">("rent");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [rentToBuyOpen, setRentToBuyOpen] = useState(false);
  const [rentToBuyInfo, setRentToBuyInfo] = useState<{
    rentalTotal: number;
    buyTotal: number;
    durationLabel: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-listing", listingId],
    queryFn: () => customerApi.getListingDetail(listingId!),
    enabled: !!listingId,
  });

  const activeVariants = data?.variants?.filter((v) => v.isActive) || [];
  const activePlans = useMemo(
    () => sortActiveRentalPlans(data?.rentalPricingPlans),
    [data?.rentalPricingPlans],
  );
  const hasPricingPlans = activePlans.length > 0;
  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId) ?? null;

  useEffect(() => {
    if (activeVariants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(activeVariants[0].id);
    }
  }, [data, activeVariants, selectedVariantId]);

  useEffect(() => {
    if (!hasPricingPlans) {
      setSelectedPlanId("");
      return;
    }
    if (selectedPlanId && activePlans.some((p) => p.id === selectedPlanId)) return;
    const recommended = activePlans.find((p) => p.isRecommended);
    setSelectedPlanId(recommended?.id ?? activePlans[0]?.id ?? "");
  }, [hasPricingPlans, activePlans, selectedPlanId]);

  if (!listingId) {
    return <p className="text-sm text-muted-foreground">Invalid listing.</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Listing not found."}</p>
        <Button variant="outline" asChild>
          <Link to="/customer/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative w-full min-w-0 overflow-hidden rounded-xl">
          <div className="block w-full pb-[75%]" aria-hidden />
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const images = data.imageUrls?.length ? data.imageUrls : [];

  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId);
  // Chemicals are buy-only and get a spec sheet; equipment follows its own rent/buy flags.
  const isChemical = !!data.isChemical;
  const canRent = !isChemical && (data.isRentEnabled ?? true);
  const canBuy = isChemical || (data.isBuyEnabled ?? false);
  const hasChemSpecs =
    isChemical &&
    (!!data.casNumber ||
      !!data.chemicalFormula ||
      data.purityPercentage != null ||
      data.molecularWeight != null);
  const actualOrderType: "rent" | "buy" = canRent && canBuy ? orderType : canBuy ? "buy" : "rent";

  // Determine current available quantity and status based on selected variant (if any)
  const currentAvailableQuantity =
    selectedVariant && data.variantInventory
      ? (data.variantInventory.find((vi) => vi.productVariantId === selectedVariant.id)?.availableQuantity ?? 0)
      : data.availableQuantity;

  const currentAvailabilityStatus =
    currentAvailableQuantity <= 0
      ? "out_of_stock"
      : currentAvailableQuantity <= 3
        ? "low_stock"
        : "available";

  const badge = availabilityBadge(currentAvailabilityStatus, currentAvailableQuantity);
  const canAddToCart = currentAvailableQuantity > 0;

  const unitPrice = selectedVariant ? selectedVariant.buyPrice : (data.buyPrice ?? 0);
  const rentRates = {
    dailyRent: data.dailyRent,
    weeklyRent: data.weeklyRent ?? 0,
    monthlyRent: data.monthlyRent,
  };
  const rentEstimate =
    actualOrderType === "buy"
      ? unitPrice * qty
      : hasPricingPlans && selectedPlan
        ? Number(selectedPlan.finalRentalPrice) * qty
        : estimateRent(periodUnit, periods, qty, rentRates);

  const promptRentToBuyIfNeeded = (next: {
    periods?: number;
    periodUnit?: RentalPeriodUnit;
    qty?: number;
    plan?: RentalPricingPlanDto | null;
  }): boolean => {
    if (!canBuy || unitPrice <= 0) return false;
    const plan = next.plan !== undefined ? next.plan : selectedPlan;
    const check = evaluateRentVsBuy({
      buyPrice: unitPrice,
      isBuyEnabled: canBuy,
      quantity: next.qty ?? qty,
      periods: plan?.durationDays ?? next.periods ?? periods,
      unit: plan ? "day" : (next.periodUnit ?? periodUnit),
      rates: rentRates,
      planFinalPrice: hasPricingPlans && plan ? plan.finalRentalPrice : null,
      planDurationLabel: hasPricingPlans && plan ? plan.durationLabel || `${plan.durationDays} days` : null,
    });
    if (!check.shouldForceBuy) return false;
    setRentToBuyInfo({
      rentalTotal: check.rentalTotal,
      buyTotal: check.buyTotal,
      durationLabel: check.durationLabel,
    });
    setRentToBuyOpen(true);
    return true;
  };

  const handlePeriodsChange = (next: number) => {
    if (promptRentToBuyIfNeeded({ periods: next })) return;
    setPeriods(next);
  };

  const handlePeriodUnitChange = (next: RentalPeriodUnit) => {
    if (promptRentToBuyIfNeeded({ periodUnit: next })) return;
    setPeriodUnit(next);
  };

  const handleQtyChange = (next: number) => {
    if (actualOrderType === "rent" && promptRentToBuyIfNeeded({ qty: next })) return;
    setQty(next);
  };

  const handleOrderTypeChange = (next: "rent" | "buy") => {
    if (next === "rent" && promptRentToBuyIfNeeded({})) return;
    setOrderType(next);
  };

  const handlePlanSelect = (plan: RentalPricingPlanDto) => {
    if (promptRentToBuyIfNeeded({ plan })) return;
    setSelectedPlanId(plan.id);
  };

  const variantStockOf = (variantId: string) =>
    activeVariants.find((v) => v.id === variantId)?.availableQuantity ??
    data.variantInventory?.find((vi) => vi.productVariantId === variantId)?.availableQuantity ??
    0;

  // When the chosen packaging size cannot cover the requested quantity, offer sibling
  // sizes that are actually in stock (real-world "1 L out, try 5 L" nudge).
  const cannotFulfillSelected = !!selectedVariant && qty > currentAvailableQuantity;
  const alternativeVariants = selectedVariant
    ? activeVariants
        .filter((v) => v.id !== selectedVariant.id && variantStockOf(v.id) > 0)
        .sort((a, b) => {
          const aFits = variantStockOf(a.id) >= qty ? 0 : 1;
          const bFits = variantStockOf(b.id) >= qty ? 0 : 1;
          if (aFits !== bFits) return aFits - bFits;
          return variantStockOf(b.id) - variantStockOf(a.id);
        })
    : [];

  const handleAdd = () => {
    if (activeVariants.length > 0 && !selectedVariantId) {
      toast.error("Please select a packaging size.");
      return;
    }
    if (actualOrderType === "rent" && hasPricingPlans) {
      if (!selectedPlan) {
        toast.error("Please select a rental duration.");
        return;
      }
    } else if (qty < 1 || (actualOrderType === "rent" && periods < 1)) {
      toast.error("Please fill in the required fields.");
      return;
    }
    if (qty > currentAvailableQuantity) {
      toast.error(`Only ${currentAvailableQuantity} unit(s) available in stock.`);
      return;
    }

    if (actualOrderType === "rent" && promptRentToBuyIfNeeded({})) {
      return;
    }

    const displayTitle = selectedVariant
      ? `${data.title} (${selectedVariant.sizeValue} ${selectedVariant.sizeUnit})`
      : data.title;

    const planBased = actualOrderType === "rent" && hasPricingPlans && selectedPlan;

    addLine({
      listingId: data.id,
      title: displayTitle,
      vendorName: data.vendorName,
      dailyRent: data.dailyRent,
      weeklyRent: data.weeklyRent ?? 0,
      monthlyRent: data.monthlyRent,
      securityDeposit: data.securityDeposit,
      primaryImageUrl: images[0],
      quantity: qty,
      rentalDays: actualOrderType === "buy" ? 0 : planBased ? selectedPlan.durationDays : periods,
      rentalPeriodUnit: actualOrderType === "buy" ? "day" : planBased ? "day" : periodUnit,
      orderType: actualOrderType,
      prescriptionRequired: data.prescriptionRequired,
      productVariantId: selectedVariantId || undefined,
      buyPrice: unitPrice,
      isBuyEnabled: canBuy,
      ...(planBased
        ? {
            rentalPricingPlanId: selectedPlan.id,
            rentalDurationLabel: selectedPlan.durationLabel,
            rentalDurationDays: selectedPlan.durationDays,
            rentalNormalPrice: selectedPlan.normalPrice,
            rentalDiscountType: selectedPlan.discountType,
            rentalDiscountValue: selectedPlan.discountValue,
            rentalFinalPrice: selectedPlan.finalRentalPrice,
          }
        : {}),
    });
    toast.success("Added to cart");
  };

  return (
    <div className="relative space-y-5">
      <div className="pointer-events-none absolute -right-6 top-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
      <BackLink to="/customer/shop" label="Back to shop" />

      <div className="relative grid gap-8 lg:grid-cols-2 lg:gap-10">
        <ProductImageGallery images={images} alt={data.title} />

        <div className="space-y-5">
          <header className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Medical equipment
              </p>
              <Badge className={badge.className}>{badge.label}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem] sm:leading-tight">
              {data.title}
            </h1>
            {data.description ? (
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{data.description}</p>
            ) : null}
            {data.prescriptionRequired ? (
              <p className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Prescription may be required
              </p>
            ) : null}
          </header>

          {/* Compact pricing */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-3.5 shadow-sm sm:p-4">
            {activeVariants.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Packaging size
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeVariants.map((v) => {
                      const stock = variantStockOf(v.id);
                      const isSelected = v.id === selectedVariantId;
                      const isOut = stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-all ${
                            isSelected
                              ? "border-primary bg-gradient-primary text-primary-foreground shadow-sm"
                              : isOut
                                ? "border-dashed text-muted-foreground"
                                : "bg-background hover:bg-muted"
                          }`}
                        >
                          <span className="block">
                            {v.sizeValue} {v.sizeUnit}
                          </span>
                          <span
                            className={`text-[10px] font-medium ${
                              isSelected
                                ? "text-primary-foreground/80"
                                : isOut
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {isOut ? "Out of stock" : `${stock} in stock`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/60 pt-2.5">
                  <span className="text-sm text-muted-foreground">
                    Price ({selectedVariant?.sizeValue} {selectedVariant?.sizeUnit})
                  </span>
                  <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    ₹{selectedVariant?.buyPrice.toFixed(0) ?? 0}
                  </span>
                </div>
                {cannotFulfillSelected && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="font-semibold">
                      {selectedVariant?.sizeValue} {selectedVariant?.sizeUnit} × {qty} isn&apos;t available
                      {currentAvailableQuantity > 0
                        ? ` (only ${currentAvailableQuantity} in stock)`
                        : " (out of stock)"}
                      .
                    </p>
                    {alternativeVariants.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {alternativeVariants.map((v) => {
                          const stock = variantStockOf(v.id);
                          return (
                            <button
                              key={`alt-${v.id}`}
                              type="button"
                              onClick={() => setSelectedVariantId(v.id)}
                              className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100"
                            >
                              {v.sizeValue} {v.sizeUnit} · ₹{v.buyPrice.toFixed(0)} · {stock} left
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 opacity-80">Try reducing the quantity.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {canRent && !hasPricingPlans && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Daily
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums">
                        ₹
                        {Math.round(
                          (data.dailyRent ?? 0) > 0
                            ? data.dailyRent
                            : (data.weeklyRent ?? 0) > 0
                              ? (data.weeklyRent ?? 0) / 7
                              : 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Monthly
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums">₹{data.monthlyRent.toFixed(0)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Deposit
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums">₹{data.securityDeposit.toFixed(0)}</p>
                    </div>
                  </div>
                )}
                {canRent && hasPricingPlans && (
                  <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-sm text-muted-foreground">Security deposit</span>
                    <span className="font-bold tabular-nums">₹{data.securityDeposit.toFixed(0)}</span>
                  </div>
                )}
                {canBuy && (
                  <div className="flex items-baseline justify-between rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <span className="text-sm text-muted-foreground">Buy price</span>
                    <span className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      ₹{data.buyPrice?.toFixed(0) ?? 0}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">
                        / {data.baseUnit ?? "Unit"}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {hasChemSpecs && (
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Chemical specifications
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-3 text-sm">
                {data.casNumber && (
                  <div>
                    <span className="text-xs text-muted-foreground">CAS Number</span>
                    <p className="font-medium">{data.casNumber}</p>
                  </div>
                )}
                {data.chemicalFormula && (
                  <div>
                    <span className="text-xs text-muted-foreground">Formula</span>
                    <p className="font-medium">{data.chemicalFormula}</p>
                  </div>
                )}
                {data.purityPercentage != null && (
                  <div>
                    <span className="text-xs text-muted-foreground">Purity</span>
                    <p className="font-medium">{data.purityPercentage}%</p>
                  </div>
                )}
                {data.molecularWeight != null && (
                  <div>
                    <span className="text-xs text-muted-foreground">Molecular Weight</span>
                    <p className="font-medium">{data.molecularWeight} g/mol</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configure + add */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="space-y-5">
              {canRent && canBuy ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange("rent")}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                      orderType === "rent"
                        ? "border-primary bg-gradient-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    Rent
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOrderTypeChange("buy")}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all ${
                      orderType === "buy"
                        ? "border-primary bg-gradient-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0" />
                    Buy
                  </button>
                </div>
              ) : (
                <div
                  className={`inline-flex items-center gap-2 rounded-xl border-2 border-primary bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20`}
                >
                  {actualOrderType === "buy" ? (
                    <>
                      <ShoppingBag className="h-4 w-4" />
                      Buy only
                    </>
                  ) : (
                    <>
                      <CalendarDays className="h-4 w-4" />
                      Rent only
                    </>
                  )}
                </div>
              )}

              {actualOrderType === "rent" && hasPricingPlans && selectedPlan ? (
                <div className="space-y-3">
                  <RentalPeriodPlanDropdown
                    plans={activePlans}
                    selectedPlanId={selectedPlanId}
                    onSelect={handlePlanSelect}
                  />

                  {/* Live copy — same as production listing detail */}
                  <p className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-600">
                    <Truck className="h-4 w-4 shrink-0 text-violet-500" />
                    Starts when the order is delivered
                  </p>

                  {/* Checkout strip: qty + deposit + rent due */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 px-4 py-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold tracking-tight text-slate-900">
                          Quantity
                          <span className="ml-0.5 text-destructive" aria-hidden>
                            *
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                          {currentAvailableQuantity > 0
                            ? `${currentAvailableQuantity} available`
                            : "Select how many units"}
                        </p>
                      </div>
                      <QuantityStepper
                        orientation="inline"
                        label="Qty"
                        required
                        value={qty}
                        min={1}
                        max={Math.max(1, currentAvailableQuantity)}
                        onChange={handleQtyChange}
                        className="[&>span]:sr-only"
                      />
                    </div>

                    <div className="space-y-3 border-t border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-inset ring-slate-200/80">
                        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                          <ShieldCheck className="h-[18px] w-[18px] text-emerald-600" />
                          Refundable deposit
                        </span>
                        <span className="text-[15px] font-bold tabular-nums text-slate-900">
                          {formatInr(data.securityDeposit * qty)}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold tracking-tight text-slate-900">
                            You pay for rent
                          </p>
                          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
                            {qty > 1
                              ? `${formatInr(selectedPlan.finalRentalPrice)} × ${qty} units`
                              : "Excludes deposit & delivery"}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "text-[24px] font-extrabold leading-none tabular-nums tracking-tight",
                            selectedPlan.isRecommended ? "text-blue-600" : "text-violet-600",
                          )}
                        >
                          {formatInr(selectedPlan.finalRentalPrice * qty)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {actualOrderType === "rent" && !hasPricingPlans ? (
                <div className="grid grid-cols-2 gap-2">
                  {RENTAL_UNITS_VISIBLE_IN_UI.map((u) => {
                    const selected = periodUnit === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => handlePeriodUnitChange(u)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                          selected
                            ? "border-primary bg-gradient-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {RENTAL_UNIT_LABELS[u].plural}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {actualOrderType === "buy" ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-xs font-medium text-muted-foreground">You pay to buy</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatInr(rentEstimate)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Own the unit · no rental return
                  </p>
                </div>
              ) : null}

              {/* Qty lives in the rental checkout strip when pricing plans are shown */}
              {!(actualOrderType === "rent" && hasPricingPlans) ? (
                <div
                  className={`grid gap-2 ${
                    actualOrderType === "rent" && !hasPricingPlans ? "sm:grid-cols-2" : ""
                  }`}
                >
                  {actualOrderType === "rent" && !hasPricingPlans ? (
                    <div className="rounded-xl border border-border bg-muted/20 px-2.5 py-1.5">
                      <QuantityStepper
                        orientation="inline"
                        label={RENTAL_UNIT_LABELS[periodUnit].plural}
                        required
                        value={periods}
                        min={1}
                        max={366}
                        onChange={handlePeriodsChange}
                      />
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border bg-muted/20 px-2.5 py-1.5">
                    <QuantityStepper
                      orientation="inline"
                      label="Qty"
                      required
                      value={qty}
                      min={1}
                      max={Math.max(1, currentAvailableQuantity)}
                      onChange={handleQtyChange}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  className="h-12 flex-1 rounded-xl bg-gradient-primary text-sm font-semibold shadow-glow hover:opacity-95"
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {canAddToCart
                    ? actualOrderType === "buy"
                      ? "Add to cart — Buy"
                      : "Add to cart — Rent"
                    : "Out of stock"}
                </Button>
                <Button variant="outline" className="h-12 rounded-xl border-2 sm:min-w-[7.5rem]" asChild>
                  <Link to="/customer/cart">View cart</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3.5">
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="h-9 px-3 text-[13px] font-medium text-slate-600 hover:text-slate-900"
                    onClick={() => {
                      if (user?.role !== "customer") {
                        toast.message("Sign in to save favorites");
                        navigate("/customer/login", {
                          state: { from: `/customer/shop/${data.id}` },
                        });
                        return;
                      }
                      customerApi
                        .addFavorite(data.id)
                        .then(() => toast.success("Added to favorites"))
                        .catch(() => toast.error("Failed to add favorite"));
                    }}
                  >
                    Favorite
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-[13px] font-medium text-slate-600 hover:text-slate-900"
                    asChild
                  >
                    <Link to="/customer/shop">More listings</Link>
                  </Button>
                </div>
                <p className="text-[12px] font-medium text-slate-500">
                  Excludes {actualOrderType === "buy" ? "delivery" : "deposit & delivery"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RentExceedsBuyDialog
        open={rentToBuyOpen}
        onOpenChange={setRentToBuyOpen}
        itemTitle={data.title}
        rentalTotal={rentToBuyInfo?.rentalTotal ?? 0}
        buyTotal={rentToBuyInfo?.buyTotal ?? 0}
        durationLabel={rentToBuyInfo?.durationLabel ?? ""}
        buyAvailable={canBuy && unitPrice > 0}
        onConfirmBuy={() => {
          if (!canBuy || unitPrice <= 0) return;
          setOrderType("buy");
          setPeriods(1);
        }}
      />
    </div>
  );
};

export default CustomerListingDetail;
