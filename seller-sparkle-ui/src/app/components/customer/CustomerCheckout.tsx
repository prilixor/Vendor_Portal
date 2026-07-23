import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { customerApi } from "@/app/services/customerApi";
import type { PlaceCustomerOrdersResultApi } from "@/app/services/customerApi";
import { useCart } from "@/app/contexts/CartContext";
import { useAuth } from "@/app/guards/AuthContext";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/app/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, FileText, CheckCircle2 } from "lucide-react";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import { CustomerMedicalReference, type DoctorRefSelection } from "./CustomerMedicalReference";
import { Checkbox } from "@/app/components/ui/checkbox";

type DeliveryChoice = "standard" | "express" | "vendor_pickup";

function formatAddressOption(a: { label?: string | null; line1: string; city: string }): string {
  const tail = `${a.line1}, ${a.city}`;
  return a.label?.trim() ? `${a.label.trim()} — ${tail}` : tail;
}

const CustomerCheckout = () => {
  const navigate = useNavigate();
  const { user, isHydrating } = useAuth();
  const queryClient = useQueryClient();
  const { lines, totalEstimatedRent, clear } = useCart();
  const [addressId, setAddressId] = useState<string>("");
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>("standard");
  const [hasInitializedAddress, setHasInitializedAddress] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [failedLines, setFailedLines] = useState<PlaceCustomerOrdersResultApi["failedLines"]>([]);
  const [medicalRefs, setMedicalRefs] = useState<Record<string, DoctorRefSelection | null>>({});

  useEffect(() => {
    if (isHydrating) return;
    if (user?.role !== "customer") {
      navigate("/customer/login", { replace: true, state: { from: "/customer/checkout" } });
    }
  }, [isHydrating, user, navigate]);

  const setMedicalRef = (listingId: string, value: DoctorRefSelection | null) => {
    setMedicalRefs((prev) => ({ ...prev, [listingId]: value }));
  };

  const applyMedicalRefToAll = (sourceListingId: string) => {
    const source = medicalRefs[sourceListingId];
    if (!source) return;

    setMedicalRefs((prev) => {
      const next = { ...prev };
      lines
        .filter((l) => l.prescriptionRequired && l.listingId !== sourceListingId)
        .forEach((l) => {
          next[l.listingId] = { ...source };
        });
      return next;
    });
    toast.success("Applied doctor reference to all prescription items");
  };

  const needsPrescription = lines.some((l) => l.prescriptionRequired);

  const { data: addresses } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: () => customerApi.getAddresses(),
    enabled: user?.role === "customer",
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
        productVariantId: l.productVariantId || undefined,
        ...(l.prescriptionRequired && medicalRefs[l.listingId]?.doctorId
          ? { doctorId: medicalRefs[l.listingId]!.doctorId }
          : {}),
      })),
    }),
    [addressId, deliveryChoice, lines, medicalRefs],
  );

  const { data: quote, isFetching: quoteLoading, error: quoteError } = useQuery({
    queryKey: ["customer-order-quote", addressId, deliveryChoice, lines],
    queryFn: () => customerApi.quoteOrders(quotePayload),
    enabled: user?.role === "customer" && lines.length > 0,
    retry: false,
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
          productVariantId: l.productVariantId || undefined,
          ...(l.prescriptionRequired && medicalRefs[l.listingId]?.doctorId
            ? { doctorId: medicalRefs[l.listingId]!.doctorId }
            : {}),
        })),
      }),
    onSuccess: (result) => {
      const placedCount = result.placedOrders.length;
      const failedCount = result.failedLines.length;
      setFailedLines(failedCount > 0 ? result.failedLines : []);
      if (placedCount > 0 && failedCount > 0) {
        const failedDetails = result.failedLines.map((l) => l.message).join(", ");
        toast.success(`Placed ${placedCount} order(s). Failed lines: ${failedDetails}`);
      } else if (placedCount > 0) {
        toast.success(`Placed ${placedCount} order(s).`);
      } else {
        const failedDetails = result.failedLines.map((l) => l.message).join(", ");
        toast.error(`No orders placed. Reason: ${failedDetails}`);
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

  if (isHydrating || user?.role !== "customer") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild variant="outline">
          <Link to="/customer/shop">Continue shopping</Link>
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

      {quoteError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
          <p className="font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Unable to place order: Stock or Validation issue
          </p>
          <p className="mt-1 text-muted-foreground ml-4">
            {quoteError instanceof Error ? quoteError.message : "A validation error occurred. Please review your cart."}
          </p>
        </div>
      )}

      {failedLines.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-bold text-amber-900 dark:text-amber-200">Some items could not be placed</p>
          <div className="mt-2 space-y-3">
            {failedLines.map((l, ix) => (
              <div key={`failed-${l.listingId}-${ix}`} className="space-y-1.5">
                <p className="text-amber-900/90 dark:text-amber-100/90">{l.message}</p>
                {l.variantSuggestions?.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-amber-800/80 dark:text-amber-200/80">Available sizes:</span>
                    {l.variantSuggestions.map((s) => (
                      <span
                        key={`sugg-${s.productVariantId}`}
                        className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-transparent dark:text-amber-100"
                      >
                        {s.sizeValue} {s.sizeUnit} · ₹{s.buyPrice.toFixed(0)} · {s.availableQuantity} in stock
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            Update the packaging size or quantity in your cart, then try again.
          </p>
        </div>
      )}

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

          {needsPrescription && (
            <Card className="border-teal-200 shadow-sm overflow-hidden bg-white">
              <div className="bg-teal-50/70 px-5 py-4 border-b border-teal-100/70 flex items-start gap-3">
                <FileText className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-teal-950">Doctor reference (optional)</h3>
                  <p className="text-sm text-teal-800/80 mt-0.5 leading-relaxed">
                    Some items can include a doctor reference. Enter the Unique ID from your doctor or their QR share page.
                    You can also skip this and place the order without one.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {lines.map((l) => {
                  if (!l.prescriptionRequired) return null;
                  const mRef = medicalRefs[l.listingId];
                  const hasFilled = !!mRef?.doctorId;
                  const hasOthers = lines.filter((x) => x.prescriptionRequired).length > 1;

                  return (
                    <div key={l.listingId} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{l.title}</p>
                        {hasFilled ? (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-[13px] text-green-700 font-medium bg-green-50/80 w-fit px-2.5 py-1 rounded-md border border-green-200/60">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>
                                {mRef!.doctorName}
                                <span className="ml-1 font-mono text-xs tracking-wide">({mRef!.uniqueCode})</span>
                              </span>
                            </div>
                            {(mRef!.hospitals?.length ?? 0) > 0 && (
                              <p className="text-[12px] text-muted-foreground pl-0.5">
                                {(mRef!.hospitals!.length === 1
                                  ? mRef!.hospitals![0].name
                                  : `${mRef!.hospitals!.length} affiliated hospitals`)}
                                {mRef!.hospitals!.length === 1 && mRef!.hospitals![0].city
                                  ? ` · ${mRef!.hospitals![0].city}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[13px] text-muted-foreground mt-1">No doctor linked yet</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Dialog onOpenChange={(open) => { if (open) setApplyToAll(false); }}>
                          <DialogTrigger asChild>
                            <Button variant={hasFilled ? "outline" : "default"} size="sm" className="h-8">
                              {hasFilled ? "Change" : (
                                <>
                                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Unique ID
                                </>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0 border-teal-100">
                            <DialogTitle className="sr-only">Doctor Unique ID</DialogTitle>
                            <DialogDescription className="sr-only">
                              Look up doctor by Unique ID for {l.title}
                            </DialogDescription>
                            <div className="p-4 sm:p-6 pb-2">
                              <CustomerMedicalReference
                                title={`Doctor for ${l.title}`}
                                value={mRef || null}
                                onChange={(v) => setMedicalRef(l.listingId, v)}
                              />
                            </div>
                            <div className="bg-muted/40 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/40 gap-4">
                              {hasOthers ? (
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`apply-all-${l.listingId}`}
                                    checked={applyToAll}
                                    onCheckedChange={(c) => setApplyToAll(!!c)}
                                  />
                                  <label
                                    htmlFor={`apply-all-${l.listingId}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
                                  >
                                    Apply to all items
                                  </label>
                                </div>
                              ) : <div />}
                              <DialogClose asChild>
                                <Button
                                  className="w-full sm:w-auto shrink-0"
                                  onClick={() => {
                                    if (applyToAll) {
                                      applyMedicalRefToAll(l.listingId);
                                    }
                                  }}
                                >
                                  Done
                                </Button>
                              </DialogClose>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit border-border/80 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="pb-4">
            <p className="text-lg font-semibold">Order summary</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              {lines.map((l) => {
                const imageUrl = resolveItemImageUrl(l);
                return (
                <div key={l.listingId} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={l.title}
                        className="h-10 w-10 shrink-0 rounded-md object-cover border border-border/40 bg-muted"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted text-[10px] text-muted-foreground">
                        No Img
                      </div>
                    )}
                    <span className="min-w-0 leading-snug">
                      <span className="font-medium tabular-nums">{l.quantity}</span>
                      <span className="text-muted-foreground"> × </span>
                      <span>{l.title}</span>
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">
                    ₹{(l.orderType === "buy"
                      ? (l.buyPrice ?? 0) * l.quantity
                      : l.dailyRent * l.quantity * l.rentalDays).toFixed(0)}
                  </span>
                </div>
                );
              })}
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
              disabled={placeMutation.isPending || !!quoteError || quoteLoading}
              onClick={() => {
                placeMutation.mutate();
              }}
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
