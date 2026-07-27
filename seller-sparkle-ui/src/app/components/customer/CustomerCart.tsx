import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart } from "@/app/contexts/CartContext";
import type { CartLine } from "@/app/contexts/CartContext";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import { useQueries } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";
import type { CustomerListingDetailApi } from "@/app/services/customerApi";
import { useAuth } from "@/app/guards/AuthContext";
import { toast } from "sonner";
import { RentExceedsBuyDialog } from "@/app/components/shared/RentExceedsBuyDialog";
import { BackLink } from "@/app/components/shared/BackLink";
import {
  RENTAL_UNIT_LABELS,
  RENTAL_UNITS_VISIBLE_IN_UI,
  estimateRent,
  evaluateRentVsBuy,
  formatRentalDuration,
  rateForUnit,
  type RentalPeriodUnit,
} from "@/app/helpers/rentalPeriod";

function CartThumb({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url?.trim() || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
        No image
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-full w-full object-contain object-center"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function CartLineCard({
  line,
  availableQuantity,
  imageUrl,
  buyEnabled,
  onUpdateQty,
  onUpdateDays,
  onUpdatePeriodUnit,
  onUpdateOrderType,
  onRemove,
}: {
  line: CartLine;
  availableQuantity?: number;
  imageUrl?: string | null;
  buyEnabled: boolean;
  onUpdateQty: (listingId: string, qty: number) => void;
  onUpdateDays: (listingId: string, days: number) => void;
  onUpdatePeriodUnit: (listingId: string, unit: RentalPeriodUnit) => void;
  onUpdateOrderType: (listingId: string, orderType: "rent" | "buy") => void;
  onRemove: (listingId: string) => void;
}) {
  const isOverStock = availableQuantity !== undefined && line.quantity > availableQuantity;
  const linePrice = line.buyPrice ?? (line.dailyRent * 30);
  const lineRent =
    line.orderType === "buy"
      ? linePrice * line.quantity
      : estimateRent(line.rentalPeriodUnit, line.rentalDays, line.quantity, {
          dailyRent: line.dailyRent,
          weeklyRent: line.weeklyRent,
          monthlyRent: line.monthlyRent,
        });
  const unitRate = rateForUnit(line.rentalPeriodUnit, line);
  const listingTo = `/customer/shop/${encodeURIComponent(line.listingId)}`;
  const thumbUrl = resolveItemImageUrl({
    primaryImageUrl: imageUrl ?? line.primaryImageUrl,
  });

  const [rentToBuyOpen, setRentToBuyOpen] = useState(false);
  const [rentToBuyInfo, setRentToBuyInfo] = useState<{
    rentalTotal: number;
    buyTotal: number;
    durationLabel: string;
  } | null>(null);

  const rates = {
    dailyRent: line.dailyRent,
    weeklyRent: line.weeklyRent,
    monthlyRent: line.monthlyRent,
  };

  const promptIfNeeded = (next: {
    periods?: number;
    unit?: RentalPeriodUnit;
    qty?: number;
  }): boolean => {
    if ((line.buyPrice ?? 0) <= 0) return false;
    const check = evaluateRentVsBuy({
      buyPrice: line.buyPrice,
      quantity: next.qty ?? line.quantity,
      periods: next.periods ?? line.rentalDays,
      unit: next.unit ?? line.rentalPeriodUnit,
      rates,
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

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        "transition-shadow hover:shadow-md",
      )}
    >
      <div className="flex gap-4">
        <Link
          to={listingTo}
          className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-24"
          aria-label={`View listing: ${line.title}`}
        >
          <CartThumb url={thumbUrl} />
        </Link>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Link
                to={listingTo}
                className="block font-semibold leading-snug hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {line.title}
              </Link>
              <p className="text-xs text-muted-foreground tabular-nums">
                {line.orderType === "buy"
                  ? `Buy Price: ₹${linePrice.toFixed(0)}`
                  : `₹${unitRate.toFixed(0)}${RENTAL_UNIT_LABELS[line.rentalPeriodUnit].per} · ${formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)} · deposit ₹${line.securityDeposit.toFixed(0)}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label="Remove from cart"
                onClick={() => onRemove(line.listingId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <p className="text-base font-bold tabular-nums">₹{lineRent.toFixed(0)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <QuantityStepper
              label="Qty"
              value={line.quantity}
              min={1}
              max={availableQuantity ?? 999}
              onChange={(qty) => {
                if (line.orderType === "rent" && promptIfNeeded({ qty })) return;
                onUpdateQty(line.listingId, qty);
              }}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Type</p>
              <Select
                value={line.orderType}
                onValueChange={(v) => {
                  const next = v as "rent" | "buy";
                  if (next === "rent" && promptIfNeeded({})) return;
                  onUpdateOrderType(line.listingId, next);
                }}
              >
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="buy">Buy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {line.orderType === "rent" ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Period</p>
                  <Select
                    value={line.rentalPeriodUnit}
                    onValueChange={(v) => {
                      const unit = v as RentalPeriodUnit;
                      if (promptIfNeeded({ unit })) return;
                      onUpdatePeriodUnit(line.listingId, unit);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RENTAL_UNITS_VISIBLE_IN_UI.map((u) => (
                        <SelectItem key={u} value={u}>
                          {RENTAL_UNIT_LABELS[u].singular}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <QuantityStepper
                  label={RENTAL_UNIT_LABELS[line.rentalPeriodUnit].plural}
                  value={line.rentalDays}
                  min={1}
                  max={366}
                  onChange={(days) => {
                    if (promptIfNeeded({ periods: days })) return;
                    onUpdateDays(line.listingId, days);
                  }}
                />
              </>
            ) : null}
          </div>
          {isOverStock && (
            <p className="text-xs font-semibold text-destructive mt-2 animate-pulse">
              Only {availableQuantity} unit(s) available in stock. Please reduce quantity to proceed.
            </p>
          )}
        </div>
      </div>

      <RentExceedsBuyDialog
        open={rentToBuyOpen}
        onOpenChange={setRentToBuyOpen}
        itemTitle={line.title}
        rentalTotal={rentToBuyInfo?.rentalTotal ?? 0}
        buyTotal={rentToBuyInfo?.buyTotal ?? 0}
        durationLabel={rentToBuyInfo?.durationLabel ?? ""}
        buyAvailable={buyEnabled && (line.buyPrice ?? 0) > 0}
        onConfirmBuy={() => {
          if (!buyEnabled || (line.buyPrice ?? 0) <= 0) return;
          onUpdateOrderType(line.listingId, "buy");
        }}
      />
    </div>
  );
}

const CustomerCart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lines, updateLine, removeLine, totalEstimatedRent } = useCart();
  const isCustomer = user?.role === "customer";

  const goToCheckout = () => {
    if (!isCustomer) {
      toast.message("Sign in to checkout", {
        description: "Create or sign in to your account to place an order.",
      });
      navigate("/customer/login", { state: { from: "/customer/checkout" } });
      return;
    }
    navigate("/customer/checkout");
  };

  const distinctListingIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.listingId))),
    [lines],
  );

  const detailQueries = useQueries({
    queries: distinctListingIds.map((id) => ({
      queryKey: ["customer-listing", id],
      queryFn: () => customerApi.getListingDetail(id),
      staleTime: 30_000,
    })),
  });

  const detailMap = useMemo(() => {
    const m = new Map<string, CustomerListingDetailApi>();
    detailQueries.forEach((q, ix) => {
      const data = q.data as CustomerListingDetailApi | undefined;
      if (data) m.set(distinctListingIds[ix], data);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQueries.map((q) => q.dataUpdatedAt).join(","), distinctListingIds]);

  // Per-line stock respects the selected packaging size (variant) when present,
  // so a 1 L order isn't validated against 5 L stock.
  const lineAvailability = (line: CartLine): number | undefined => {
    const detail = detailMap.get(line.listingId);
    if (!detail) return undefined;
    if (line.productVariantId) {
      const variant = detail.variants?.find((v) => v.id === line.productVariantId);
      if (variant?.availableQuantity !== undefined) return variant.availableQuantity;
      const vi = detail.variantInventory?.find((x) => x.productVariantId === line.productVariantId);
      return vi?.availableQuantity ?? 0;
    }
    return detail.availableQuantity;
  };

  const hasStockIssues = useMemo(
    () =>
      lines.some((l) => {
        const avail = lineAvailability(l);
        return avail !== undefined && l.quantity > avail;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, detailMap],
  );

  const totalDeposit = useMemo(
    () => lines.reduce((sum, l) => sum + (l.orderType === "buy" ? 0 : l.securityDeposit * l.quantity), 0),
    [lines],
  );

  return (
    <div className="space-y-8">
      <div>
        <BackLink to="/customer/shop" label="Back to shop" />
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review items and proceed to checkout.</p>
      </div>

      {lines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Button asChild className="bg-gradient-primary hover:opacity-95 shadow-glow">
              <Link to="/customer/shop">Continue shopping</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="space-y-4">
            {lines.map((line) => (
              <CartLineCard
                key={`${line.listingId}-${line.productVariantId ?? "base"}`}
                line={line}
                availableQuantity={lineAvailability(line)}
                imageUrl={resolveItemImageUrl(detailMap.get(line.listingId))}
                buyEnabled={detailMap.get(line.listingId)?.isBuyEnabled === true}
                onUpdateQty={(listingId, qty) => updateLine(listingId, { quantity: qty })}
                onUpdateDays={(listingId, rentalDays) => updateLine(listingId, { rentalDays })}
                onUpdatePeriodUnit={(listingId, rentalPeriodUnit) => updateLine(listingId, { rentalPeriodUnit })}
                onUpdateOrderType={(listingId, orderType) => updateLine(listingId, { orderType })}
                onRemove={removeLine}
              />
            ))}
          </div>

          <Card className="h-fit border-border/80 shadow-sm lg:sticky lg:top-4">
            <CardContent className="space-y-4 p-6">
              <p className="text-lg font-semibold">Order summary</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="shrink-0 tabular-nums text-foreground">₹{totalEstimatedRent.toFixed(0)}</span>
                </div>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Refundable deposit</span>
                  <span className="shrink-0 tabular-nums text-foreground">₹{totalDeposit.toFixed(0)}</span>
                </div>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Service fee</span>
                  <span className="shrink-0 tabular-nums text-foreground">₹0</span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-3 text-base font-bold">
                  <span>Total</span>
                  <span className="shrink-0 tabular-nums">₹{totalEstimatedRent.toFixed(0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total reflects estimated rent. Deposit may be collected separately per vendor policy.
                </p>
              </div>
              {hasStockIssues ? (
                <Button className="w-full bg-foreground text-background opacity-50 cursor-not-allowed" disabled size="lg">
                  Proceed to checkout
                </Button>
              ) : (
                <Button
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  size="lg"
                  onClick={goToCheckout}
                >
                  {isCustomer ? "Proceed to checkout" : "Sign in to checkout"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerCart;
