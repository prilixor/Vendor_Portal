import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { customerApi } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { useAuth } from "@/app/guards/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { ProductImageGallery } from "@/app/components/shared/ProductImageGallery";
import { RentExceedsBuyDialog } from "@/app/components/shared/RentExceedsBuyDialog";
import { BackLink } from "@/app/components/shared/BackLink";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import {
  DEFAULT_UI_RENTAL_UNIT,
  RENTAL_UNIT_LABELS,
  RENTAL_UNITS_VISIBLE_IN_UI,
  estimateRent,
  evaluateRentVsBuy,
  type RentalPeriodUnit,
} from "@/app/helpers/rentalPeriod";

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

  const activeVariants = data?.variants?.filter(v => v.isActive) || [];

  useEffect(() => {
    if (activeVariants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(activeVariants[0].id);
    }
  }, [data, activeVariants, selectedVariantId]);

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
  
  const selectedVariant = activeVariants.find(v => v.id === selectedVariantId);
  // Chemicals are buy-only and get a spec sheet; equipment follows its own rent/buy flags.
  const isChemical = !!data.isChemical;
  const canRent = !isChemical && (data.isRentEnabled ?? true);
  const canBuy = isChemical || (data.isBuyEnabled ?? false);
  const hasChemSpecs = isChemical && (
    !!data.casNumber || !!data.chemicalFormula ||
    data.purityPercentage != null || data.molecularWeight != null
  );
  const actualOrderType: "rent" | "buy" =
    canRent && canBuy ? orderType : canBuy ? "buy" : "rent";

  // Determine current available quantity and status based on selected variant (if any)
  const currentAvailableQuantity = selectedVariant && data.variantInventory
    ? data.variantInventory.find(vi => vi.productVariantId === selectedVariant.id)?.availableQuantity ?? 0
    : data.availableQuantity;
    
  const currentAvailabilityStatus = currentAvailableQuantity <= 0
    ? "out_of_stock"
    : (currentAvailableQuantity <= 3 ? "low_stock" : "available");

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
      : estimateRent(periodUnit, periods, qty, rentRates);

  const promptRentToBuyIfNeeded = (next: {
    periods?: number;
    periodUnit?: RentalPeriodUnit;
    qty?: number;
  }): boolean => {
    if (unitPrice <= 0) return false;
    const check = evaluateRentVsBuy({
      buyPrice: unitPrice,
      quantity: next.qty ?? qty,
      periods: next.periods ?? periods,
      unit: next.periodUnit ?? periodUnit,
      rates: rentRates,
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
    if (qty < 1 || (actualOrderType === "rent" && periods < 1)) {
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
      rentalDays: actualOrderType === "buy" ? 0 : periods,
      rentalPeriodUnit: actualOrderType === "buy" ? "day" : periodUnit,
      orderType: actualOrderType,
      prescriptionRequired: data.prescriptionRequired,
      productVariantId: selectedVariantId || undefined,
      buyPrice: unitPrice,
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
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                {data.description}
              </p>
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
                {canRent && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/40 px-2.5 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Weekly
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums">₹{(data.weeklyRent ?? 0).toFixed(0)}</p>
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

          {/* Compact configure + add */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-tight">Configure & add</p>
              <p className="text-sm font-bold tabular-nums text-foreground">
                ₹{rentEstimate.toFixed(0)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">est.</span>
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {canRent && canBuy ? (
                  <div className="inline-grid grid-cols-2 gap-1">
                    {(["rent", "buy"] as const).map((type) => {
                      const selected = orderType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleOrderTypeChange(type)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                            selected
                              ? "border-primary bg-gradient-primary text-primary-foreground shadow-sm"
                              : "border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {type === "rent" ? "Rent" : "Buy"}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
                    {actualOrderType === "buy" ? "Buy only" : "Rent only"}
                  </span>
                )}

                {actualOrderType === "rent" ? (
                  <div className="inline-grid grid-cols-2 gap-1">
                    {RENTAL_UNITS_VISIBLE_IN_UI.map((u) => {
                      const selected = periodUnit === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handlePeriodUnitChange(u)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                            selected
                              ? "border-primary/40 bg-primary-soft text-primary"
                              : "border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {RENTAL_UNIT_LABELS[u].plural}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div
                className={`grid gap-2 ${
                  actualOrderType === "rent" ? "sm:grid-cols-2" : "sm:max-w-xs"
                }`}
              >
                {actualOrderType === "rent" ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5">
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
                <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5">
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

              <p className="text-xs text-muted-foreground">
                Estimated {actualOrderType === "buy" ? "buy" : "rent"} (excludes{" "}
                {actualOrderType === "buy" ? "delivery" : "deposit & delivery"}).
              </p>

              <div className="flex flex-col gap-2 pt-0.5 sm:flex-row">
                <Button
                  className="h-11 flex-1 bg-gradient-primary text-sm font-semibold shadow-glow hover:opacity-95"
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAddToCart}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {canAddToCart ? "Add to cart" : "Out of stock"}
                </Button>
                <Button variant="outline" className="h-11 sm:w-auto" asChild>
                  <Link to="/customer/cart">View cart</Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-muted-foreground"
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
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/customer/shop">More listings</Link>
                </Button>
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
