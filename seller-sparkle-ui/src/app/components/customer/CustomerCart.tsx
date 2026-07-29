import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Minus, Package, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/app/contexts/CartContext";
import type { CartLine } from "@/app/contexts/CartContext";
import { Button } from "@/app/components/ui/button";
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

function CartThumb({ url, title }: { url?: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!url?.trim() || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/30">
        <Package className="h-6 w-6 text-muted-foreground/45" aria-hidden />
        <span className="sr-only">No image for {title}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={title}
      className="h-full w-full object-contain object-center p-1.5"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function SegmentTrack({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "plain";
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex flex-wrap gap-1.5",
        tone === "muted" && "rounded-xl bg-muted/35 p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SegmentButton({
  selected,
  disabled,
  onClick,
  children,
  variant = "primary",
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** primary = Rent/Buy brand fill; soft = Weeks/Months outline fill */
  variant?: "primary" | "soft";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-9 rounded-lg px-3.5 text-sm font-semibold tracking-tight transition-all",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        variant === "primary" &&
          (selected
            ? "border border-primary/45 bg-primary-soft text-primary shadow-sm"
            : "border border-border/80 bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary-soft/40 hover:text-foreground"),
        variant === "soft" &&
          (selected
            ? "border border-primary/45 bg-primary-soft text-primary shadow-sm"
            : "border border-transparent bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"),
      )}
    >
      {children}
    </button>
  );
}

function StepperField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-2.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="inline-flex items-center">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function lineFlags(
  detail: CustomerListingDetailApi | undefined,
  line: CartLine,
): { isChemical: boolean; canRent: boolean; canBuy: boolean } {
  if (!detail) {
    return {
      isChemical: false,
      canRent: line.orderType === "rent",
      canBuy: line.orderType === "buy" || (line.buyPrice ?? 0) > 0,
    };
  }
  const isChemical = !!detail.isChemical;
  return {
    isChemical,
    canRent: !isChemical && (detail.isRentEnabled ?? true),
    canBuy: isChemical || (detail.isBuyEnabled ?? false),
  };
}

/** Compact buy-only row for chemicals / consumables. */
function ChemicalCartLine({
  line,
  availableQuantity,
  imageUrl,
  onUpdateQty,
  onRemove,
}: {
  line: CartLine;
  availableQuantity?: number;
  imageUrl?: string | null;
  onUpdateQty: (listingId: string, qty: number) => void;
  onRemove: (listingId: string) => void;
}) {
  const isOverStock = availableQuantity !== undefined && line.quantity > availableQuantity;
  const unitPrice = line.buyPrice ?? 0;
  const lineTotal = unitPrice * line.quantity;
  const listingTo = `/customer/shop/${encodeURIComponent(line.listingId)}`;
  const thumbUrl = resolveItemImageUrl({
    primaryImageUrl: imageUrl ?? line.primaryImageUrl,
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-black/[0.02]">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
        <Link
          to={listingTo}
          className="relative h-20 w-20 shrink-0 self-center sm:self-start overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/40 sm:h-24 sm:w-24 lg:h-28 lg:w-28"
          aria-label={`View listing: ${line.title}`}
        >
          <CartThumb url={thumbUrl} title={line.title} />
        </Link>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Link
                to={listingTo}
                className="block text-[15px] font-semibold leading-snug tracking-tight hover:text-primary sm:text-base"
              >
                {line.title}
              </Link>
              <p className="text-xs leading-relaxed text-muted-foreground tabular-nums">
                ₹{unitPrice.toFixed(0)} each
                <span className="mx-1.5 text-border">·</span>
                Purchase
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="text-base font-bold tracking-tight tabular-nums sm:text-lg">₹{lineTotal.toFixed(0)}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove from cart"
                onClick={() => onRemove(line.listingId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 max-w-xs">
            <StepperField
              label="Quantity"
              value={line.quantity}
              min={1}
              max={availableQuantity ?? 999}
              onChange={(qty) => onUpdateQty(line.listingId, qty)}
            />
            {isOverStock ? (
              <p className="mt-1.5 text-xs font-semibold text-destructive">
                Only {availableQuantity} available — please reduce quantity.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function CartLineCard({
  line,
  availableQuantity,
  imageUrl,
  canRent,
  canBuy,
  onUpdateQty,
  onUpdateDays,
  onUpdatePeriodUnit,
  onUpdateOrderType,
  onRemove,
}: {
  line: CartLine;
  availableQuantity?: number;
  imageUrl?: string | null;
  canRent: boolean;
  canBuy: boolean;
  onUpdateQty: (listingId: string, qty: number) => void;
  onUpdateDays: (listingId: string, days: number) => void;
  onUpdatePeriodUnit: (listingId: string, unit: RentalPeriodUnit) => void;
  onUpdateOrderType: (listingId: string, orderType: "rent" | "buy") => void;
  onRemove: (listingId: string) => void;
}) {
  // Match listing detail: chemicals / flags decide rent vs buy — never invent both when only one applies.
  const actualOrderType: "rent" | "buy" =
    canRent && canBuy ? line.orderType : canBuy ? "buy" : "rent";

  const isOverStock = availableQuantity !== undefined && line.quantity > availableQuantity;
  const linePrice = line.buyPrice ?? line.dailyRent * 30;
  const lineRent =
    actualOrderType === "buy"
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
    if (!canBuy || (line.buyPrice ?? 0) <= 0) return false;
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
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm shadow-black/[0.02]">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
        <Link
          to={listingTo}
          className="relative h-28 w-28 shrink-0 self-center sm:self-start overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/50 sm:h-36 sm:w-36 lg:h-40 lg:w-40"
          aria-label={`View listing: ${line.title}`}
        >
          <CartThumb url={thumbUrl} title={line.title} />
        </Link>

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Link
                to={listingTo}
                className="block text-base font-bold leading-snug tracking-tight hover:text-primary sm:text-[17px]"
              >
                {line.title}
              </Link>
              <p className="text-xs leading-relaxed text-muted-foreground tabular-nums sm:text-[13px]">
                {actualOrderType === "buy" ? (
                  <>₹{linePrice.toFixed(0)} each</>
                ) : (
                  <>
                    ₹{unitRate.toFixed(0)}
                    {RENTAL_UNIT_LABELS[line.rentalPeriodUnit].per}
                    <span className="mx-1.5 text-border">·</span>
                    {formatRentalDuration(line.rentalDays, line.rentalPeriodUnit)}
                    <span className="mx-1.5 text-border">·</span>
                    Deposit ₹{line.securityDeposit.toFixed(0)}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="text-lg font-bold tracking-tight tabular-nums sm:text-xl">
                ₹{lineRent.toFixed(0)}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove from cart"
                onClick={() => onRemove(line.listingId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-end gap-5">
              {canRent && canBuy ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Order type
                  </p>
                  <SegmentTrack tone="plain">
                    {(["rent", "buy"] as const).map((type) => {
                      const selected = line.orderType === type;
                      return (
                        <SegmentButton
                          key={type}
                          variant="primary"
                          selected={selected}
                          onClick={() => {
                            if (type === "rent" && promptIfNeeded({})) return;
                            onUpdateOrderType(line.listingId, type);
                          }}
                        >
                          {type === "rent" ? "Rent" : "Buy"}
                        </SegmentButton>
                      );
                    })}
                  </SegmentTrack>
                </div>
              ) : canRent && !canBuy ? (
                <div className="inline-flex min-h-9 items-center rounded-lg border border-primary/35 bg-primary-soft px-3 text-sm font-semibold text-primary">
                  Rent only
                </div>
              ) : null}

              {actualOrderType === "rent" ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Rental period
                  </p>
                  <SegmentTrack tone="muted">
                    {RENTAL_UNITS_VISIBLE_IN_UI.map((u) => (
                      <SegmentButton
                        key={u}
                        variant="soft"
                        selected={line.rentalPeriodUnit === u}
                        onClick={() => {
                          if (promptIfNeeded({ unit: u })) return;
                          onUpdatePeriodUnit(line.listingId, u);
                        }}
                      >
                        {RENTAL_UNIT_LABELS[u].plural}
                      </SegmentButton>
                    ))}
                  </SegmentTrack>
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "grid gap-2 sm:gap-3",
                actualOrderType === "rent" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:max-w-xs",
              )}
            >
              {actualOrderType === "rent" ? (
                <StepperField
                  label={RENTAL_UNIT_LABELS[line.rentalPeriodUnit].plural}
                  value={line.rentalDays}
                  min={1}
                  max={366}
                  onChange={(days) => {
                    if (promptIfNeeded({ periods: days })) return;
                    onUpdateDays(line.listingId, days);
                  }}
                />
              ) : null}
              <StepperField
                label="Quantity"
                value={line.quantity}
                min={1}
                max={availableQuantity ?? 999}
                onChange={(qty) => {
                  if (actualOrderType === "rent" && promptIfNeeded({ qty })) return;
                  onUpdateQty(line.listingId, qty);
                }}
              />
            </div>

            {isOverStock ? (
              <p className="text-xs font-semibold text-destructive">
                Only {availableQuantity} available — please reduce quantity.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <RentExceedsBuyDialog
        open={rentToBuyOpen}
        onOpenChange={setRentToBuyOpen}
        itemTitle={line.title}
        rentalTotal={rentToBuyInfo?.rentalTotal ?? 0}
        buyTotal={rentToBuyInfo?.buyTotal ?? 0}
        durationLabel={rentToBuyInfo?.durationLabel ?? ""}
        buyAvailable={canBuy && (line.buyPrice ?? 0) > 0}
        onConfirmBuy={() => {
          if (!canBuy || (line.buyPrice ?? 0) <= 0) return;
          onUpdateOrderType(line.listingId, "buy");
        }}
      />
    </article>
  );
}

function OrderSummaryPanel({
  totalEstimatedRent,
  totalDeposit,
  hasStockIssues,
  isCustomer,
  onCheckout,
  className,
}: {
  totalEstimatedRent: number;
  totalDeposit: number;
  hasStockIssues: boolean;
  isCustomer: boolean;
  onCheckout: () => void;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl shadow-black/[0.04]",
        className,
      )}
    >
      <div className="border-b border-border/50 bg-gradient-to-br from-primary-soft/90 via-card to-card px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Checkout</p>
        <h2 className="mt-0.5 text-lg font-bold tracking-tight">Order summary</h2>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-semibold tabular-nums text-foreground">
              ₹{totalEstimatedRent.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Refundable deposit</span>
            <span className="font-semibold tabular-nums text-foreground">
              ₹{totalDeposit.toFixed(0)}
            </span>
          </div>
          {false && (
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Service fee</span>
              <span className="tabular-nums text-foreground">₹0</span>
            </div>
          )}
          <div className="flex items-end justify-between gap-3 border-t border-border/60 pt-3">
            <div>
              <p className="text-sm font-semibold">Estimated total</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Deposit collected at delivery</p>
            </div>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              ₹{totalEstimatedRent.toFixed(0)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
          Secure checkout · Adjust options anytime before placing the order
        </div>

        <div className="hidden space-y-2 lg:block">
          {hasStockIssues ? (
            <Button className="h-12 w-full opacity-50" disabled>
              Proceed to checkout
            </Button>
          ) : (
            <Button
              className="h-12 w-full bg-gradient-primary text-[15px] font-semibold shadow-glow hover:opacity-95"
              onClick={onCheckout}
            >
              {isCustomer ? "Proceed to checkout" : "Sign in to checkout"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button asChild variant="ghost" className="h-10 w-full text-muted-foreground">
            <Link to="/customer/shop">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </aside>
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

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const { equipmentLines, chemicalLines } = useMemo(() => {
    const equipment: CartLine[] = [];
    const chemicals: CartLine[] = [];
    for (const line of lines) {
      const flags = lineFlags(detailMap.get(line.listingId), line);
      if (flags.isChemical) chemicals.push(line);
      else equipment.push(line);
    }
    return { equipmentLines: equipment, chemicalLines: chemicals };
  }, [lines, detailMap]);

  const renderLine = (line: CartLine) => {
    const flags = lineFlags(detailMap.get(line.listingId), line);
    const key = `${line.listingId}-${line.productVariantId ?? "base"}`;
    const avail = lineAvailability(line);
    const imageUrl = resolveItemImageUrl(detailMap.get(line.listingId));

    if (flags.isChemical) {
      return (
        <ChemicalCartLine
          key={key}
          line={line}
          availableQuantity={avail}
          imageUrl={imageUrl}
          onUpdateQty={(listingId, qty) => updateLine(listingId, { quantity: qty })}
          onRemove={removeLine}
        />
      );
    }

    return (
      <CartLineCard
        key={key}
        line={line}
        availableQuantity={avail}
        imageUrl={imageUrl}
        canRent={flags.canRent}
        canBuy={flags.canBuy}
        onUpdateQty={(listingId, qty) => updateLine(listingId, { quantity: qty })}
        onUpdateDays={(listingId, rentalDays) => updateLine(listingId, { rentalDays })}
        onUpdatePeriodUnit={(listingId, rentalPeriodUnit) =>
          updateLine(listingId, { rentalPeriodUnit })
        }
        onUpdateOrderType={(listingId, orderType) => updateLine(listingId, { orderType })}
        onRemove={removeLine}
      />
    );
  };

  return (
    <div className={cn("space-y-6", lines.length > 0 && "pb-28 lg:pb-0")}>
      {/* Hero header — richer than plain text */}
      <header className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary-soft/80 via-card to-card px-4 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-primary-glow/10 blur-2xl" />
        <div className="relative space-y-3">
          <BackLink to="/customer/shop" label="Back to shop" />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your cart</h1>
              </div>
              {lines.length > 0 && (
                <p className="max-w-md text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? "item" : "items"} ready for checkout.
                </p>
              )}
            </div>
            {lines.length > 0 ? (
              <div className="rounded-full border border-primary/20 bg-background/80 px-3.5 py-1.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold tracking-tight">Your cart is empty</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Browse equipment to rent or buy, then return here to checkout.
          </p>
          <Button asChild size="lg" className="mt-6 bg-gradient-primary px-6 shadow-glow hover:opacity-95">
            <Link to="/customer/shop">
              Browse shop
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:items-start lg:gap-8">
          <div className="space-y-6">
            {equipmentLines.length > 0 ? (
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <h2 className="text-sm font-semibold tracking-tight">Equipment</h2>
                  <p className="text-xs text-muted-foreground">
                    {equipmentLines.length}{" "}
                    {equipmentLines.length === 1 ? "item" : "items"} · rent or buy
                  </p>
                </div>
                <div className="space-y-3">{equipmentLines.map(renderLine)}</div>
              </section>
            ) : null}

            {chemicalLines.length > 0 ? (
              <section className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2 px-0.5">
                  <h2 className="text-sm font-semibold tracking-tight">Chemicals & consumables</h2>
                  <p className="text-xs text-muted-foreground">
                    {chemicalLines.length}{" "}
                    {chemicalLines.length === 1 ? "item" : "items"} · buy only
                  </p>
                </div>
                <div className="space-y-2">{chemicalLines.map(renderLine)}</div>
              </section>
            ) : null}
          </div>

          <OrderSummaryPanel
            className="lg:sticky lg:top-4"
            totalEstimatedRent={totalEstimatedRent}
            totalDeposit={totalDeposit}
            hasStockIssues={hasStockIssues}
            isCustomer={isCustomer}
            onCheckout={goToCheckout}
          />
        </div>
      )}

      {/* Mobile sticky checkout bar — real-world pattern */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Estimated total
              </p>
              <p className="truncate text-lg font-bold tabular-nums">₹{totalEstimatedRent.toFixed(0)}</p>
            </div>
            <Button
              className="h-12 shrink-0 bg-gradient-primary px-5 font-semibold shadow-glow hover:opacity-95"
              disabled={hasStockIssues}
              onClick={goToCheckout}
            >
              Checkout
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomerCart;
