import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { customerApi } from "@/app/services/customerApi";
import type { PlaceCustomerOrdersResultApi } from "@/app/services/customerApi";
import { estimateCartLineRent, useCart } from "@/app/contexts/CartContext";
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
import { Loader2, Plus, FileText, CheckCircle2, MapPin } from "lucide-react";
import { cn, resolveItemImageUrl, retryOriginalOnImageError } from "@/app/helpers/utils";
import { CustomerMedicalReference, type DoctorRefSelection } from "./CustomerMedicalReference";
import { Checkbox } from "@/app/components/ui/checkbox";
import { RentExceedsBuyDialog } from "@/app/components/shared/RentExceedsBuyDialog";
import { BackLink } from "@/app/components/shared/BackLink";
import { StruckPrice } from "@/app/components/shared/RentalPeriodPlanDropdown";
import { dayPlanTitle } from "@/app/helpers/rentalDurationIcons";
import { formatRentalDuration } from "@/app/helpers/rentalPeriod";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type DeliveryChoice = "standard" | "express" | "vendor_pickup";

/** Temporary: hide Vendor pickup from checkout UI (keep code for later). */
const SHOW_VENDOR_PICKUP_OPTION = false;

function formatAddressOption(a: { label?: string | null; line1: string; city: string }): string {
  const tail = `${a.line1}, ${a.city}`;
  return a.label?.trim() ? `${a.label.trim()} — ${tail}` : tail;
}

function formatCheckoutInr(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const CustomerCheckout = () => {
  const navigate = useNavigate();
  const { user, isHydrating } = useAuth();
  const queryClient = useQueryClient();
  const { lines, totalEstimatedRent, clear, updateLine } = useCart();
  const [addressId, setAddressId] = useState<string>("");
  const [deliveryChoice, setDeliveryChoice] = useState<DeliveryChoice>("standard");
  const [hasInitializedAddress, setHasInitializedAddress] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [failedLines, setFailedLines] = useState<PlaceCustomerOrdersResultApi["failedLines"]>([]);
  const [medicalRefs, setMedicalRefs] = useState<Record<string, DoctorRefSelection | null>>({});
  const [rentToBuyOpen, setRentToBuyOpen] = useState(false);
  const [rentToBuySuggestion, setRentToBuySuggestion] = useState<{
    listingId: string;
    listingTitle: string;
    rentAmount: number;
    buyAmount: number;
  } | null>(null);

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
        rentalPeriodUnit: l.rentalPeriodUnit,
        orderType: l.orderType,
        productVariantId: l.productVariantId || undefined,
        ...(l.rentalPricingPlanId
          ? {
              rentalPricingPlanId: l.rentalPricingPlanId,
            }
          : {}),
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
          rentalPeriodUnit: l.rentalPeriodUnit,
          orderType: l.orderType,
          productVariantId: l.productVariantId || undefined,
          ...(l.rentalPricingPlanId
            ? {
                rentalPricingPlanId: l.rentalPricingPlanId,
              }
            : {}),
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
    onError: (err: Error) => toast.error(getUserFriendlyMessage(err, "Unable to place your order. Please try again.")),
  });

  useEffect(() => {
    if (!quote?.buySuggestions?.length) return;
    // API only suggests when Buy is enabled. Skip lines explicitly marked rent-only.
    const stillRent = quote.buySuggestions.find((s) =>
      lines.some(
        (l) => l.listingId === s.listingId && l.orderType === "rent" && l.isBuyEnabled !== false,
      ),
    );
    if (!stillRent) return;
    setRentToBuySuggestion({
      listingId: stillRent.listingId,
      listingTitle: stillRent.listingTitle,
      rentAmount: stillRent.rentAmount,
      buyAmount: stillRent.buyAmount,
    });
    setRentToBuyOpen(true);
  }, [quote?.buySuggestions, lines]);

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
        <BackLink to="/customer/cart" label="Back to cart" />
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm delivery details and place your rental request.
        </p>
      </div>

      {quoteError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
          <p className="font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Unable to continue checkout
          </p>
          <p className="mt-1 text-muted-foreground ml-4">
            {getUserFriendlyMessage(
              quoteError,
              "Please review your delivery address and cart, then try again.",
            )}
          </p>
        </div>
      )}

      {failedLines.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-bold text-amber-900 dark:text-amber-200">Some items could not be placed</p>
          <div className="mt-2 space-y-3">
            {failedLines.map((l, ix) => (
              <div key={`failed-${l.listingId}-${ix}`} className="space-y-1.5">
                <p className="text-amber-900/90 dark:text-amber-100/90">
                  {getUserFriendlyMessage(l.message, "This item could not be ordered. Please update your cart and try again.")}
                </p>
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
              {(addresses ?? []).length === 0 ? (
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">No delivery address yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add an address with a map pin to continue checkout.
                    </p>
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link to="/customer/addresses">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Address
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="checkout-address" required>
                        Saved address
                      </Label>
                      <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-lg font-medium" asChild>
                        <Link to="/customer/addresses">
                          <MapPin className="h-3.5 w-3.5" />
                          Manage addresses
                        </Link>
                      </Button>
                    </div>
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
                </>
              )}
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
                {SHOW_VENDOR_PICKUP_OPTION && (
                  <label
                    htmlFor="delivery-pickup"
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors",
                      "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="vendor_pickup" id="delivery-pickup" />
                      <span className="text-sm font-medium">Pickup in person</span>
                    </div>
                    <span className="shrink-0 text-sm text-muted-foreground">Free</span>
                  </label>
                )}
              </RadioGroup>
            </CardContent>
          </Card>

          {needsPrescription && (
            <Card className="overflow-hidden border-teal-200 bg-card shadow-sm dark:border-teal-500/30">
              <div className="flex items-start gap-3 border-b border-teal-100/70 bg-teal-50/70 px-5 py-4 dark:border-teal-500/20 dark:bg-teal-500/10">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
                <div>
                  <h3 className="font-semibold text-teal-950 dark:text-teal-50">Doctor reference (optional)</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-teal-800/80 dark:text-teal-200/80">
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
                            <div className="flex w-fit items-center gap-1.5 rounded-md border border-green-200/60 bg-green-50/80 px-2.5 py-1 text-[13px] font-medium text-green-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
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
                          <DialogContent className="max-h-[90vh] overflow-y-auto border-border p-0 sm:max-w-[480px]">
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
            <div className="space-y-4 text-sm">
              {lines.map((l) => {
                const imageUrl = resolveItemImageUrl(l);
                const isPlanBased = !!l.rentalPricingPlanId && l.rentalFinalPrice != null;
                const hasDiscount =
                  isPlanBased &&
                  l.rentalNormalPrice != null &&
                  Number(l.rentalNormalPrice) > Number(l.rentalFinalPrice);
                return (
                <div key={l.listingId} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={l.title}
                        className="h-11 w-11 shrink-0 rounded-md object-cover border border-border/40 bg-muted"
                        onError={retryOriginalOnImageError}
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted text-[10px] text-muted-foreground">
                        No Img
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="leading-snug">
                        <span className="font-medium tabular-nums">{l.quantity}</span>
                        <span className="text-muted-foreground"> × </span>
                        <span className="font-medium">{l.title}</span>
                      </p>
                      {l.orderType === "rent" && isPlanBased ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="text-xs font-medium text-foreground">
                            {dayPlanTitle(Number(l.rentalDurationDays ?? l.rentalDays ?? 0))}
                          </p>
                          {hasDiscount ? (
                            <p className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                              <StruckPrice className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                                {formatCheckoutInr(Number(l.rentalNormalPrice))}
                              </StruckPrice>
                              <span className="text-sm font-semibold text-foreground">
                                {formatCheckoutInr(Number(l.rentalFinalPrice))}
                              </span>
                              <span className="text-[11px] text-muted-foreground">each</span>
                            </p>
                          ) : l.rentalFinalPrice != null ? (
                            <p className="text-xs font-medium tabular-nums text-foreground">
                              {formatCheckoutInr(Number(l.rentalFinalPrice))} each
                            </p>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">Starts on delivery</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 pt-0.5 font-semibold tabular-nums">
                    {formatCheckoutInr(estimateCartLineRent(l))}
                  </span>
                </div>
                );
              })}
            </div>

              <div className="space-y-2.5 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Subtotal</span>
                  <span className="tabular-nums text-foreground">{formatCheckoutInr(quote?.subtotalAmount ?? totalEstimatedRent)}</span>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Deposit</span>
                  <span className="tabular-nums text-foreground">{formatCheckoutInr(quote?.depositAmount ?? totalDeposit)}</span>
              </div>
              {expressFee > 0 ? (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Express delivery</span>
                  <span className="tabular-nums text-foreground">{formatCheckoutInr(expressFee)}</span>
                </div>
              ) : null}
                {distanceFee > 0 ? (
                  <div className="flex justify-between gap-4 text-muted-foreground">
                    <span>Distance delivery fee</span>
                    <span className="tabular-nums text-foreground">{formatCheckoutInr(distanceFee)}</span>
                  </div>
                ) : null}
              {/* Service fee UI hidden — keep for future re-enable */}
              {false && (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>Service fee</span>
                  <span className="tabular-nums text-foreground">{formatCheckoutInr(serviceFee)}</span>
                </div>
              )}
              {gstAmount > 0 ? (
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <span>GST</span>
                  <span className="tabular-nums text-foreground">{formatCheckoutInr(gstAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t pt-3 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatCheckoutInr(grandTotal)}</span>
              </div>
                {quoteLoading && (
                  <p className="text-xs text-muted-foreground">Updating distance-based charges…</p>
                )}
                {quote?.buySuggestions?.length ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                    {quote.buySuggestions.map((s) => (
                      <p key={s.listingId} className="leading-relaxed">
                        <span className="font-medium">{s.listingTitle}:</span> Rent {formatCheckoutInr(s.rentAmount)} meets or
                        exceeds Buy {formatCheckoutInr(s.buyAmount)} — switched to Buy.
                      </p>
                    ))}
                  </div>
                ) : null}
            </div>

            <Button
              className="w-full bg-gradient-primary font-semibold text-primary-foreground shadow-glow hover:opacity-95"
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
              You&apos;ll be charged after BlinksMed confirms.
            </p>
          </CardContent>
        </Card>
      </div>

      <RentExceedsBuyDialog
        open={rentToBuyOpen}
        onOpenChange={setRentToBuyOpen}
        itemTitle={rentToBuySuggestion?.listingTitle}
        rentalTotal={rentToBuySuggestion?.rentAmount ?? 0}
        buyTotal={rentToBuySuggestion?.buyAmount ?? 0}
        durationLabel={(() => {
          const line = lines.find((l) => l.listingId === rentToBuySuggestion?.listingId);
          if (!line) return "this rental";
          if (line.rentalDurationLabel) return line.rentalDurationLabel;
          return formatRentalDuration(line.rentalDays, line.rentalPeriodUnit);
        })()}
        buyAvailable={
          lines.some(
            (l) =>
              l.listingId === rentToBuySuggestion?.listingId &&
              l.isBuyEnabled !== false &&
              (l.buyPrice ?? 0) > 0,
          )
        }
        compulsory
        onConfirmBuy={() => {
          const switchable = (l: (typeof lines)[number]) =>
            l.orderType === "rent" && l.isBuyEnabled !== false;
          for (const s of quote?.buySuggestions ?? []) {
            const line = lines.find((l) => l.listingId === s.listingId && switchable(l));
            if (line) updateLine(line.listingId, { orderType: "buy" });
          }
          if (rentToBuySuggestion) {
            const line = lines.find(
              (l) => l.listingId === rentToBuySuggestion.listingId && switchable(l),
            );
            if (line) updateLine(line.listingId, { orderType: "buy" });
          }
          setRentToBuySuggestion(null);
          toast.success("Order type updated to Buy");
        }}
      />
    </div>
  );
};

export default CustomerCheckout;
