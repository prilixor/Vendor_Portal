import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart } from "@/app/contexts/CartContext";
import type { CartLine } from "@/app/contexts/CartContext";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { QuantityStepper } from "@/app/components/ui/quantity-stepper";
import { cn } from "@/app/helpers/utils";

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
  onUpdateQty,
  onUpdateDays,
  onRemove,
}: {
  line: CartLine;
  onUpdateQty: (listingId: string, qty: number) => void;
  onUpdateDays: (listingId: string, days: number) => void;
  onRemove: (listingId: string) => void;
}) {
  const lineRent = line.dailyRent * line.quantity * line.rentalDays;
  const listingTo = `/customer/browse/${encodeURIComponent(line.listingId)}`;

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
          <CartThumb url={line.primaryImageUrl} />
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
              <p className="text-sm text-muted-foreground">{line.vendorName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                ₹{line.dailyRent.toFixed(0)} / day · {line.rentalDays} days · deposit ₹
                {line.securityDeposit.toFixed(0)}
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
              max={999}
              onChange={(qty) => onUpdateQty(line.listingId, qty)}
            />
            <QuantityStepper
              label="Days"
              value={line.rentalDays}
              min={1}
              max={366}
              onChange={(days) => onUpdateDays(line.listingId, days)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomerCart = () => {
  const { lines, updateLine, removeLine, totalEstimatedRent } = useCart();

  const totalDeposit = useMemo(
    () => lines.reduce((sum, l) => sum + l.securityDeposit * l.quantity, 0),
    [lines],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review items and proceed to checkout.</p>
      </div>

      {lines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Button asChild className="bg-gradient-primary hover:opacity-95 shadow-glow">
              <Link to="/customer/browse">Browse rentals</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="space-y-4">
            {lines.map((line) => (
              <CartLineCard
                key={line.listingId}
                line={line}
                onUpdateQty={(listingId, qty) => updateLine(listingId, { quantity: qty })}
                onUpdateDays={(listingId, rentalDays) => updateLine(listingId, { rentalDays })}
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
              <Button className="w-full bg-foreground text-background hover:bg-foreground/90" asChild size="lg">
                <Link to="/customer/checkout">Proceed to checkout</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerCart;
