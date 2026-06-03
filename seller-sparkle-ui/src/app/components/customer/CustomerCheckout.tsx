import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { customerApi } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/app/helpers/utils";

type DeliveryChoice = "standard" | "express" | "vendor_pickup";

function formatAddressOption(a: { label?: string | null; line1: string; city: string }): string {
  const tail = `${a.line1}, ${a.city}`;
  return a.label?.trim() ? `${a.label.trim()} — ${tail}` : tail;
}

const CustomerCheckout = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { lines, totalEstimatedRent, clear } = useCart();
  const [addressId, setAddressId] = useState<string>("");
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>("standard");
  const [hasInitializedAddress, setHasInitializedAddress] = useState(false);

  const { data: addresses } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => customerApi.getAddresses(),
  });

  useEffect(() => {
    if (addresses && !hasInitializedAddress) {
      const defaultAddr = addresses.find((a) => a.isDefault);
      if (defaultAddr) {
        setAddressId(defaultAddr.id);
      }
      setHasInitializedAddress(true);
    }
  }, [addresses, hasInitializedAddress]);

  const totalDeposit = useMemo(
    () => lines.reduce((sum, l) => sum + (l.orderType === "buy" ? 0 : l.securityDeposit * l.quantity), 0),
    [lines],
  );

  const quotePayload = useMemo(
    () => ({
      deliveryOption: deliveryChoice,
      customerAddressId: addressId || undefined,
      lines: lines.map((l) => ({
        listingId: l.listingId,
        quantity: l.quantity,
        rentalDays: l.rentalDays,
        orderType: l.orderType,
      })),
    }),
    [addressId, deliveryChoice, lines],
  );

  const { data: quote, isFetching: quoteLoading } = useQuery({
    queryKey: ["customer-order-quote", addressId, deliveryChoice, lines],
    queryFn: () => customerApi.quoteOrders(quotePayload),
    enabled: lines.length > 0,
  });

  const expressFee = quote?.expressFeeAmount ?? 0;
  const distanceFee = quote?.distanceFeeAmount ?? 0;
  const serviceFee = quote?.serviceFeeAmount ?? 0;
  const gstAmount = quote?.gstAmount ?? 0;
  const grandTotal = quote?.totalAmount ?? (totalEstimatedRent + totalDeposit + serviceFee + gstAmount);

  const placeMutation = useMutation({
    mutationFn: () =>
      customerApi.placeOrders({
        deliveryOption: deliveryChoice,
        customerAddressId: addressId || undefined,
        lines: lines.map((l) => ({
          listingId: l.listingId,
          quantity: l.quantity,
          rentalDays: l.rentalDays,
          orderType: l.orderType,
        })),
      }),
    onSuccess: (result) => {
      const placedCount = result.placedOrders.length;
      const failedCount = result.failedLines.length;
      if (placedCount > 0 && failedCount > 0) {
        toast.success(`Placed ${placedCount} order(s), ${failedCount} failed.`);
      } else if (placedCount > 0) {
        toast.success(`Placed ${placedCount} order(s).`);
      } else {
        toast.error(`No orders placed. ${failedCount} line(s) failed.`);
      }

      if (placedCount > 0) {
        clear();
        queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
        navigate("/customer/orders");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!quote?.buySuggestions?.length) return;
    const suggestion = quote.buySuggestions[0];
    toast.message(
      `Buy suggestion for "${suggestion.listingTitle}": save ₹${suggestion.savingsAmount.toFixed(0)} if you buy.`,
    );
  }, [quote?.buySuggestions]);

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild variant="outline">
          <Link to="/customer/browse">Browse rentals</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm delivery details and place your rental request.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
        <div className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-base font-semibold">Delivery address</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="checkout-address">Saved address</Label>
                <Select
                  value={addressId || "none"}
                  onValueChange={(v) => setAddressId(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="checkout-address" className="h-11 w-full">
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(addresses ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatAddressOption(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="link" className="h-auto px-0 text-xs text-muted-foreground" asChild>
                <Link to="/customer/addresses">Manage addresses</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4">
              <p className="text-base font-semibold">Delivery option</p>
            </CardHeader>
            <CardContent className="pt-0">
              <RadioGroup
                value={deliveryChoice}
                onValueChange={(v) => setDeliveryChoice(v as DeliveryChoice)}
                className="divide-y rounded-xl border border-border"
              >
                <label
                  htmlFor="delivery-standard"
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                    "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="standard" id="delivery-standard" />
                    <span className="text-sm font-medium">Standard (2-3 days)</span>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">Included</span>
                </label>
                <label
                  htmlFor="delivery-express"
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                    "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="express" id="delivery-express" />
                    <span className="text-sm font-medium">Express (next-day)</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                    Dynamic
                  </span>
                </label>
                <label
                  htmlFor="delivery-pickup"
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                    "hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="vendor_pickup" id="delivery-pickup" />
                    <span className="text-sm font-medium">Vendor pickup</span>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">Free</span>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-border/80 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="pb-4">
            <p className="text-lg font-semibold">Order summary</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              {lines.map((l) => (
                <div key={l.listingId} className="flex justify-between gap-4">
                  <span className="min-w-0 leading-snug">
                    <span className="font-medium tabular-nums">{l.quantity}</span>
                    <span className="text-muted-foreground"> × </span>
                    <span>{l.title}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    ₹{(l.dailyRent * l.quantity * l.rentalDays).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

              <div className="space-y-2.5 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Subtotal</span>
                  <span className="tabular-nums text-foreground">₹{(quote?.subtotalAmount ?? totalEstimatedRent).toFixed(0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Deposit</span>
                  <span className="tabular-nums text-foreground">₹{(quote?.depositAmount ?? totalDeposit).toFixed(0)}</span>
              </div>
              {expressFee > 0 ? (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Express delivery</span>
                  <span className="tabular-nums text-foreground">₹{expressFee.toFixed(0)}</span>
                </div>
              ) : null}
                {distanceFee > 0 ? (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Distance delivery fee</span>
                    <span className="tabular-nums text-foreground">₹{distanceFee.toFixed(0)}</span>
                  </div>
                ) : null}
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Service fee</span>
                <span className="tabular-nums text-foreground">₹{serviceFee.toFixed(0)}</span>
              </div>
              {gstAmount > 0 ? (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>GST</span>
                  <span className="tabular-nums text-foreground">₹{gstAmount.toFixed(0)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t pt-3 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">₹{grandTotal.toFixed(0)}</span>
              </div>
                {quoteLoading && (
                  <p className="text-xs text-muted-foreground">Updating distance-based charges…</p>
                )}
                {quote?.buySuggestions?.length ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                    {quote.buySuggestions.map((s) => (
                      <p key={s.listingId} className="leading-relaxed">
                        <span className="font-medium">{s.listingTitle}:</span> Rent ₹{s.rentAmount.toFixed(0)} is higher than
                        Buy ₹{s.buyAmount.toFixed(0)} (save ₹{s.savingsAmount.toFixed(0)}).
                      </p>
                    ))}
                  </div>
                ) : null}
            </div>

            <Button
              className="w-full bg-foreground text-background hover:bg-foreground/90"
              size="lg"
              disabled={placeMutation.isPending}
              onClick={() => placeMutation.mutate()}
            >
              {placeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing order…
                </>
              ) : (
                "Place order"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You&apos;ll be charged after the vendor confirms.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerCheckout;
