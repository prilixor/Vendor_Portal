import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { customerApi } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { useAuth } from "@/app/guards/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

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
  const [days, setDays] = useState(7);
  const [orderType, setOrderType] = useState<"rent" | "buy">("rent");
  const [imgIx, setImgIx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

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
          <Link to="/customer/browse">Back to browse</Link>
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
  const rentEstimate = actualOrderType === "buy" ? unitPrice * qty : data.dailyRent * qty * days;

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
    if (qty < 1 || (actualOrderType === "rent" && days < 1)) {
      toast.error("Please fill in the required fields.");
      return;
    }
    if (qty > currentAvailableQuantity) {
      toast.error(`Only ${currentAvailableQuantity} unit(s) available in stock.`);
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
      monthlyRent: data.monthlyRent,
      securityDeposit: data.securityDeposit,
      primaryImageUrl: images[0],
      quantity: qty,
      rentalDays: actualOrderType === "buy" ? 0 : days,
      orderType: actualOrderType,
      prescriptionRequired: data.prescriptionRequired,
      productVariantId: selectedVariantId || undefined,
      buyPrice: unitPrice,
    });
    toast.success("Added to cart");
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <div className="relative w-full overflow-hidden rounded-xl border bg-card">
          <div className="block w-full pb-[75%]" aria-hidden />
          {images.length > 0 ? (
            <img
              src={images[imgIx % images.length]}
              alt=""
              className="customer-catalog-media-img"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                maxWidth: "none",
                maxHeight: "none",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
              }}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No photos
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((url, i) => (
              <button
                key={`listing-img-${i}`}
                type="button"
                onClick={() => setImgIx(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-card ${i === imgIx ? "border-primary" : "border-transparent"}`}
              >
                <img
                  src={url}
                  alt=""
                  className="customer-catalog-media-img"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    maxWidth: "none",
                    maxHeight: "none",
                    objectFit: "contain",
                    objectPosition: "center",
                    display: "block",
                  }}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={badge.className}>{badge.label}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-medium">Pricing</p>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {activeVariants.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Available Packaging Sizes</span>
                  <div className="flex flex-wrap gap-2">
                    {activeVariants.map((v) => {
                      const stock = variantStockOf(v.id);
                      const isSelected = v.id === selectedVariantId;
                      const isOut = stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`flex flex-col items-start px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : isOut
                                ? "bg-background text-muted-foreground border-dashed"
                                : "bg-background hover:bg-muted text-foreground"
                          }`}
                        >
                          <span>{v.sizeValue} {v.sizeUnit}</span>
                          <span className={`text-[10px] font-medium ${isSelected ? "text-indigo-100" : isOut ? "text-destructive" : "text-muted-foreground"}`}>
                            {isOut ? "Out of stock" : `${stock} in stock`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between items-center border-t pt-2.5 mt-2">
                  <span className="text-muted-foreground">Price ({selectedVariant?.sizeValue} {selectedVariant?.sizeUnit})</span>
                  <span className="font-bold tabular-nums text-lg text-emerald-600 dark:text-emerald-400">
                    ₹{selectedVariant?.buyPrice.toFixed(0) ?? 0}
                  </span>
                </div>
                {cannotFulfillSelected && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <p className="font-semibold">
                      {selectedVariant?.sizeValue} {selectedVariant?.sizeUnit} × {qty} isn&apos;t available
                      {currentAvailableQuantity > 0 ? ` (only ${currentAvailableQuantity} in stock)` : " (out of stock)"}.
                    </p>
                    {alternativeVariants.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-amber-800/80 dark:text-amber-200/80">Try another packaging size:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {alternativeVariants.map((v) => {
                            const stock = variantStockOf(v.id);
                            return (
                              <button
                                key={`alt-${v.id}`}
                                type="button"
                                onClick={() => setSelectedVariantId(v.id)}
                                className="rounded-md border border-amber-400 bg-white px-2 py-1 font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:bg-transparent dark:text-amber-100"
                              >
                                {v.sizeValue} {v.sizeUnit} · ₹{v.buyPrice.toFixed(0)} · {stock} in stock
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-amber-800/80 dark:text-amber-200/80">No other sizes are in stock right now. Try reducing the quantity.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {canRent && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily rent</span>
                      <span className="font-semibold tabular-nums">₹{data.dailyRent.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly rent</span>
                      <span className="font-semibold tabular-nums">₹{data.monthlyRent.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Security deposit</span>
                      <span className="font-semibold tabular-nums">₹{data.securityDeposit.toFixed(0)}</span>
                    </div>
                  </>
                )}
                {canBuy && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buy price</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">₹{data.buyPrice?.toFixed(0) ?? 0} / {data.baseUnit ?? "Unit"}</span>
                  </div>
                )}
                {data.prescriptionRequired && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Prescription may be required for this category.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {hasChemSpecs && (
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium">Chemical Specifications</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              {data.casNumber && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">CAS Number</span>
                  <span className="font-medium">{data.casNumber}</span>
                </div>
              )}
              {data.chemicalFormula && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Formula</span>
                  <span className="font-medium">{data.chemicalFormula}</span>
                </div>
              )}
              {data.purityPercentage != null && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Purity</span>
                  <span className="font-medium">{data.purityPercentage}%</span>
                </div>
              )}
              {data.molecularWeight != null && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Molecular Weight</span>
                  <span className="font-medium">{data.molecularWeight} g/mol</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data.description ? (
          <div>
            <p className="text-sm font-medium">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.description}</p>
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <p className="text-sm font-medium">Add to cart</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              {canRent && canBuy && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Order type</p>
                  <Select value={orderType} onValueChange={(v) => setOrderType(v as "rent" | "buy")}>
                    <SelectTrigger className="h-10 w-[140px]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="buy">Buy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <QuantityStepper label="Qty" required value={qty} min={1} max={Math.max(1, currentAvailableQuantity)} onChange={setQty} />
              {actualOrderType === "rent" ? (
                <QuantityStepper
                  label="Days"
                  required
                  value={days}
                  min={1}
                  max={366}
                  onChange={setDays}
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Fields marked <span className="text-destructive">*</span> are required.
            </p>
            <p className="text-xs text-muted-foreground">
              Estimated {actualOrderType === "buy" ? "buy amount" : "rent"} for this line:{" "}
              <span className="font-semibold text-foreground tabular-nums">₹{rentEstimate.toFixed(0)}</span>{" "}
              (excludes {actualOrderType === "buy" ? "delivery" : "deposit & delivery"}).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-gradient-primary hover:opacity-95 shadow-glow"
                type="button"
                onClick={handleAdd}
                disabled={!canAddToCart}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {canAddToCart ? "Add to cart" : "Out of stock"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  if (user?.role !== "customer") {
                    toast.message("Sign in to save favorites");
                    navigate("/customer/login", {
                      state: { from: `/customer/browse/${data.id}` },
                    });
                    return;
                  }
                  customerApi
                    .addFavorite(data.id)
                    .then(() => toast.success("Added to favorites"))
                    .catch(() => toast.error("Failed to add favorite"));
                }}
              >
                Favorite ❤️
              </Button>
              <Button variant="outline" asChild>
                <Link to="/customer/cart">View cart</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/customer/browse">More listings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerListingDetail;
