import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { customerApi, type CustomerListingDetailApi, type RentalPricingPlanDto } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { useAuth } from "@/app/guards/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ProductImageGallery } from "@/app/components/shared/ProductImageGallery";
import { RentExceedsBuyDialog } from "@/app/components/shared/RentExceedsBuyDialog";
import { BackLink } from "@/app/components/shared/BackLink";
import {
  RentalPeriodPlanDropdown,
  sortActiveRentalPlans,
} from "@/app/components/shared/RentalPeriodPlanDropdown";
import { dayPlanTitle } from "@/app/helpers/rentalDurationIcons";
import { CustomerProductDocumentsInline } from "@/app/components/shared/CatalogProductDocumentsList";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Heart,
  LayoutGrid,
  ShoppingBag,
  ShoppingCart,
  CalendarDays,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { evaluateRentVsBuy } from "@/app/helpers/rentalPeriod";
import { cn } from "@/app/helpers/utils";

function availabilityBadge(status: string, qty: number): { label: string; className: string } | null {
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
  // In-stock / available: no badge per product requirement
  return null;
}

function formatInr(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function variantStockOfDetail(data: CustomerListingDetailApi, variantId: string): number {
  const fromVariant = data.variants?.find((v) => v.id === variantId)?.availableQuantity;
  if (typeof fromVariant === "number") return Math.max(0, fromVariant);
  return Math.max(
    0,
    data.variantInventory?.find((vi) => vi.productVariantId === variantId)?.availableQuantity ?? 0,
  );
}

/** Equipment: all vendors combined. Chemicals: selected pack size across vendors. */
function resolveCustomerAvailableQuantity(
  data: CustomerListingDetailApi,
  selectedVariantId: string,
): number {
  if (selectedVariantId) {
    return variantStockOfDetail(data, selectedVariantId);
  }
  return Math.max(0, data.productTotalAvailableQuantity ?? data.availableQuantity ?? 0);
}

const CustomerListingDetail = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addLine } = useCart();
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<"rent" | "buy">("rent");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [rentToBuyOpen, setRentToBuyOpen] = useState(false);
  const [rentToBuyInfo, setRentToBuyInfo] = useState<{
    rentalTotal: number;
    buyTotal: number;
    durationLabel: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-listing", listingId],
    queryFn: () => customerApi.getListingDetail(listingId!),
    enabled: !!listingId,
  });
  const { data: favorites = [] } = useQuery({
    queryKey: ["customer-favorites"],
    queryFn: () => customerApi.getFavorites(),
    enabled: user?.role === "customer",
  });
  const isFavorite = !!listingId && favorites.some((f) => f.vendorProductListingId === listingId);

  const activeVariants = data?.variants?.filter((v) => v.isActive) || [];
  const resolvedVariantId = useMemo(() => {
    if (selectedVariantId && activeVariants.some((v) => v.id === selectedVariantId)) {
      return selectedVariantId;
    }
    if (!data || activeVariants.length === 0) return "";
    return (
      activeVariants.find((v) => variantStockOfDetail(data, v.id) > 0)?.id ??
      activeVariants[0].id
    );
  }, [data, activeVariants, selectedVariantId]);
  const activePlans = useMemo(
    () => sortActiveRentalPlans(data?.rentalPricingPlans),
    [data?.rentalPricingPlans],
  );
  const hasPricingPlans = activePlans.length > 0;
  const selectedPlan = activePlans.find((p) => p.id === selectedPlanId) ?? null;

  useEffect(() => {
    if (!data || activeVariants.length === 0) return;
    if (selectedVariantId && activeVariants.some((v) => v.id === selectedVariantId)) return;
    const inStock = activeVariants.find((v) => variantStockOfDetail(data, v.id) > 0);
    setSelectedVariantId(inStock?.id ?? activeVariants[0].id);
  }, [data, activeVariants, selectedVariantId]);

  useEffect(() => {
    if (!data) return;
    const available = resolveCustomerAvailableQuantity(data, resolvedVariantId);
    setQty((prev) => {
      if (available <= 0) return 1;
      return Math.min(Math.max(1, prev), available);
    });
  }, [data, resolvedVariantId]);

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
    return <PageLoaderSlot />;
  }

  const images = data.imageUrls?.length ? data.imageUrls : [];

  const selectedVariant = activeVariants.find((v) => v.id === resolvedVariantId);
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

  const currentAvailableQuantity = resolveCustomerAvailableQuantity(data, resolvedVariantId);

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
      : selectedPlan
        ? Number(selectedPlan.finalRentalPrice) * qty
        : 0;

  const promptRentToBuyIfNeeded = (next: {
    qty?: number;
    plan?: RentalPricingPlanDto | null;
  }): boolean => {
    if (!canBuy || unitPrice <= 0) return false;
    const plan = next.plan !== undefined ? next.plan : selectedPlan;
    if (!plan) return false;
    const check = evaluateRentVsBuy({
      buyPrice: unitPrice,
      isBuyEnabled: canBuy,
      quantity: next.qty ?? qty,
      periods: plan.durationDays,
      unit: "day",
      rates: rentRates,
      planFinalPrice: plan.finalRentalPrice,
      planDurationLabel: plan.durationLabel || `${plan.durationDays} days`,
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

  const variantStockOf = (variantId: string) => variantStockOfDetail(data, variantId);

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
    if (activeVariants.length > 0 && !resolvedVariantId) {
      toast.error("Please select a packaging size.");
      return;
    }
    if (qty < 1) {
      toast.error("Please fill in the required fields.");
      return;
    }
    if (actualOrderType === "rent") {
      if (!hasPricingPlans || !selectedPlan) {
        toast.error("Rental plans are not configured for this product.");
        return;
      }
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

    const planBased = actualOrderType === "rent" && !!selectedPlan;

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
      rentalDays: actualOrderType === "buy" ? 0 : selectedPlan!.durationDays,
      rentalPeriodUnit: "day",
      orderType: actualOrderType,
      prescriptionRequired: data.prescriptionRequired,
      productVariantId: resolvedVariantId || undefined,
      buyPrice: unitPrice,
      isBuyEnabled: canBuy,
      ...(planBased
        ? {
            rentalPricingPlanId: selectedPlan.id,
            rentalDurationLabel: dayPlanTitle(
              selectedPlan.durationDays,
              selectedPlan.durationLabel,
            ),
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
    <div className="relative min-w-0 max-w-full overflow-x-clip space-y-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-6 top-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <BackLink to="/customer/shop" label="Back to shop" />

      <div className="relative grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0">
          <ProductImageGallery images={images} alt={data.title} />
        </div>

        <div className="min-w-0 space-y-5">
          <header className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                {data.isChemical
                  ? (data.categoryName?.trim() || "Chemicals")
                  : (data.categoryName?.trim() || "Medical equipment")}
              </p>
              {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem] sm:leading-tight">
              {data.title}
            </h1>
            {data.description ? (
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{data.description}</p>
            ) : null}
            {(data.documents?.length ?? 0) > 0 ? (
              <div className="pt-1">
                <CustomerProductDocumentsInline documents={data.documents ?? []} />
              </div>
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
                  <div
                    className={cn(
                      "grid gap-2",
                      activeVariants.length === 1 ? "grid-cols-1" : "grid-cols-2",
                      "sm:flex sm:flex-wrap",
                    )}
                  >
                    {activeVariants.map((v) => {
                      const stock = variantStockOf(v.id);
                      const isSelected = v.id === resolvedVariantId;
                      const isOut = stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`min-w-0 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-all sm:min-w-[7.25rem] sm:py-1.5 ${
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
                              className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
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
                {canRent && (
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
          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
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
                  <p className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                    <Truck className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
                    Starts when the order is delivered
                  </p>

                  {/* Checkout strip: qty + deposit + rent due */}
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 px-4 py-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold tracking-tight text-foreground">
                          Quantity
                          <span className="ml-0.5 text-destructive" aria-hidden>
                            *
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
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

                    <div className="space-y-3 border-t border-border bg-muted/30 px-4 py-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3 ring-1 ring-inset ring-border">
                        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-foreground">
                          <ShieldCheck className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
                          Refundable deposit
                        </span>
                        <span className="text-[15px] font-bold tabular-nums text-foreground">
                          {formatInr(data.securityDeposit * qty)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold tracking-tight text-foreground">
                            You pay for rent
                          </p>
                          <p className="mt-1 text-[12px] font-medium leading-snug text-muted-foreground">
                            {qty > 1
                              ? `${formatInr(selectedPlan.finalRentalPrice)} × ${qty} units`
                              : "Excludes deposit & delivery"}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-[22px] font-extrabold leading-none tabular-nums tracking-tight sm:text-[24px]",
                            selectedPlan.isRecommended
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-violet-600 dark:text-violet-400",
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
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold">Rental plans not configured</p>
                    <p className="text-[13px] leading-snug opacity-90">
                      This product cannot be rented until an admin adds rental pricing plans.
                      {canBuy ? " You can still buy it if buy is enabled." : ""}
                    </p>
                  </div>
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
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold tracking-tight text-foreground">
                        Quantity
                        <span className="ml-0.5 text-destructive" aria-hidden>
                          *
                        </span>
                      </p>
                      <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                        {currentAvailableQuantity > 0
                          ? selectedVariant
                            ? `${currentAvailableQuantity} available · ${selectedVariant.sizeValue} ${selectedVariant.sizeUnit}`
                            : `${currentAvailableQuantity} available`
                          : "Out of stock"}
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
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <Button
                  className="h-12 flex-1 rounded-xl bg-gradient-primary text-sm font-semibold shadow-glow hover:opacity-95"
                  type="button"
                  onClick={handleAdd}
                  disabled={
                    !canAddToCart || (actualOrderType === "rent" && (!hasPricingPlans || !selectedPlan))
                  }
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="h-9 rounded-lg px-3 font-medium"
                    onClick={() => {
                      if (user?.role !== "customer") {
                        toast.message("Sign in to save favorites");
                        navigate("/customer/login", {
                          state: { from: `/customer/shop/${data.id}` },
                        });
                        return;
                      }
                      const action = isFavorite
                        ? customerApi.removeFavorite(data.id).then(() => toast.success("Removed from favorites"))
                        : customerApi.addFavorite(data.id).then(() => toast.success("Added to favorites"));
                      action
                        .then(() => queryClient.invalidateQueries({ queryKey: ["customer-favorites"] }))
                        .catch(() => toast.error(isFavorite ? "Failed to remove favorite" : "Failed to add favorite"));
                    }}
                  >
                    <Heart className={cn("h-4 w-4", isFavorite && "fill-destructive text-destructive")} />
                    {isFavorite ? "Saved" : "Favorite"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg px-3 font-medium"
                    asChild
                  >
                    <Link to="/customer/shop">
                      <LayoutGrid className="h-4 w-4" />
                      More listings
                    </Link>
                  </Button>
                </div>
                <p className="text-[12px] font-medium text-muted-foreground">
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
