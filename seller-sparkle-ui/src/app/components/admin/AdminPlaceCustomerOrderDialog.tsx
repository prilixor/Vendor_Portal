import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  adminApi,
  AdminCustomerDetailDto,
  AdminOrderableListingDto,
} from "@/app/services/adminApi";
import { customerApi, CustomerListingDetailApi, ProductVariantDto } from "@/app/services/customerApi";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";
import { FilterCategoryList } from "@/app/components/shared/ProfessionalFilters";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";

type Step = "search" | "configure" | "cart" | "success";
type BrowseMode = "equipment" | "chemicals";

/** Max listings loaded per browse request (Equipment or Chemicals tab). */
const ADMIN_BROWSE_LISTING_LIMIT = 100;

interface AdminCartLine {
  key: string;
  listingId: string;
  title: string;
  vendorName: string;
  categoryName: string;
  isChemical: boolean;
  prescriptionRequired: boolean;
  primaryImageUrl?: string | null;
  quantity: number;
  rentalDays: number;
  orderType: "rent" | "buy";
  productVariantId?: string;
  variantLabel?: string;
  dailyRent: number;
  buyPrice?: number;
}

type MedicalRef = {
  hospitalId: string;
  doctorId: string;
  referenceNumber: string;
};

function cartKey(listingId: string, variantId?: string) {
  return `${listingId}::${variantId || ""}`;
}

function formatMoney(amount: number) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function lineEstimate(line: AdminCartLine) {
  const qty = Math.max(1, line.quantity);
  if (line.orderType === "buy") {
    return (line.buyPrice ?? 0) * qty;
  }
  return (line.dailyRent || 0) * Math.max(1, line.rentalDays) * qty;
}

function stockBadge(status: string, qty: number) {
  if (status === "out_of_stock" || qty <= 0) {
    return <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">Out of stock</Badge>;
  }
  if (status === "low_stock" || qty <= 3) {
    return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">Low · {qty}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">{qty} available</Badge>;
}

function typeBadge(isChemical: boolean) {
  if (isChemical) {
    return (
      <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-800 border-violet-200">
        Chemical
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-800 border-teal-200">
      Equipment
    </Badge>
  );
}

function priceHint(listing: AdminOrderableListingDto, mode: BrowseMode) {
  if (mode === "chemicals" || listing.isChemical) {
    if (listing.buyPrice != null && listing.buyPrice > 0) {
      if (listing.maxBuyPrice != null && listing.maxBuyPrice > listing.buyPrice) {
        return `Buy ${formatMoney(listing.buyPrice)}–${formatMoney(listing.maxBuyPrice)}`;
      }
      return `Buy ${formatMoney(listing.buyPrice)}`;
    }
    return "Buy pricing on select";
  }
  const parts: string[] = [];
  if (listing.isRentEnabled && listing.dailyRent > 0) {
    parts.push(`${formatMoney(listing.dailyRent)}/day rent`);
  }
  if (listing.isBuyEnabled && listing.buyPrice != null && listing.buyPrice > 0) {
    parts.push(`Buy ${formatMoney(listing.buyPrice)}`);
  }
  return parts.join(" · ") || "Pricing on select";
}

function ListingThumb({ src, isChemical }: { src?: string | null; isChemical?: boolean }) {
  const [broken, setBroken] = useState(false);
  const url = src?.trim();
  if (!url || broken) {
    return (
      <div className={cn(
        "h-full w-full flex items-center justify-center",
        isChemical ? "bg-violet-50 text-violet-400" : "bg-teal-50 text-teal-400",
      )}>
        {isChemical ? <FlaskConical className="h-5 w-5" /> : <Package className="h-5 w-5" />}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

function unitPriceLabel(line: AdminCartLine) {
  if (line.orderType === "buy") {
    return `${formatMoney(line.buyPrice ?? 0)} each`;
  }
  return `${formatMoney(line.dailyRent)}/day`;
}

function CartItemTile({
  line,
  onUpdate,
  onRemove,
}: {
  line: AdminCartLine;
  onUpdate: (key: string, patch: Partial<Pick<AdminCartLine, "quantity" | "rentalDays">>) => void;
  onRemove: (key: string) => void;
}) {
  const img = resolveItemImageUrl({ primaryImageUrl: line.primaryImageUrl });
  const total = lineEstimate(line);
  const isRent = line.orderType === "rent";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        line.isChemical ? "border-violet-200/80" : "border-teal-200/80",
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            "w-1.5 shrink-0",
            line.isChemical ? "bg-violet-500" : "bg-teal-500",
          )}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 gap-3 p-3 sm:p-4">
          <div className="h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem] rounded-lg border bg-muted/30 overflow-hidden shrink-0">
            <ListingThumb src={img} isChemical={line.isChemical} />
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-sm sm:text-[15px] leading-snug line-clamp-2">{line.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {line.vendorName}
                  {line.categoryName ? ` · ${line.categoryName}` : ""}
                </p>
                {line.variantLabel && (
                  <p className="text-xs text-foreground/80">
                    Size: <span className="font-medium">{line.variantLabel}</span>
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 -mt-1 -mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onRemove(line.key)}
                aria-label={`Remove ${line.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {typeBadge(line.isChemical)}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  isRent
                    ? "bg-sky-50 text-sky-800 border-sky-200"
                    : "bg-indigo-50 text-indigo-800 border-indigo-200",
                )}
              >
                {isRent ? "Rent" : "Buy"}
              </Badge>
              {line.prescriptionRequired && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                  Rx required
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pt-1 border-t border-border/60">
              <div className="flex flex-wrap items-end gap-3 pt-2.5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Qty</p>
                  <div className="inline-flex items-center rounded-lg border bg-background">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none rounded-l-lg"
                      onClick={() => onUpdate(line.key, { quantity: line.quantity - 1 })}
                      disabled={line.quantity <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-9 text-center text-sm font-semibold tabular-nums border-x">{line.quantity}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none rounded-r-lg"
                      onClick={() => onUpdate(line.key, { quantity: line.quantity + 1 })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {isRent && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Days</p>
                    <Input
                      className="h-8 w-[4.5rem] text-center tabular-nums font-semibold"
                      type="number"
                      min={1}
                      value={line.rentalDays}
                      onChange={(e) =>
                        onUpdate(line.key, { rentalDays: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </div>
                )}
              </div>

              <div className="text-left sm:text-right pt-2.5 sm:pt-0 sm:pl-3">
                <p className="text-[11px] text-muted-foreground">
                  {unitPriceLabel(line)}
                  {isRent ? ` × ${line.rentalDays}d` : ""} × {line.quantity}
                </p>
                <p className="text-base sm:text-lg font-bold tabular-nums tracking-tight">{formatMoney(total)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customer: AdminCustomerDetailDto;
  onPlaced: () => void;
}

export function AdminPlaceCustomerOrderDialog({ open, onOpenChange, customerId, customer, onPlaced }: Props) {
  const [step, setStep] = useState<Step>("search");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("equipment");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<AdminOrderableListingDto[]>([]);
  const [searching, setSearching] = useState(false);

  const [cart, setCart] = useState<AdminCartLine[]>([]);
  const [selected, setSelected] = useState<AdminOrderableListingDto | null>(null);
  const [detail, setDetail] = useState<CustomerListingDetailApi | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [orderType, setOrderType] = useState<"rent" | "buy">("rent");
  const [quantity, setQuantity] = useState("1");
  const [rentalDays, setRentalDays] = useState("7");
  const [variantId, setVariantId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [deliveryOption, setDeliveryOption] = useState("standard");
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [medicalRefs, setMedicalRefs] = useState<Record<string, MedicalRef>>({});
  const [placeErrors, setPlaceErrors] = useState<string[]>([]);
  const [placedOrders, setPlacedOrders] = useState<{ id: string; orderNumber: string; listingTitle?: string }[]>([]);

  const updateMedicalRef = (listingId: string, field: keyof MedicalRef, value: string) => {
    setMedicalRefs((prev) => ({
      ...prev,
      [listingId]: {
        hospitalId: "",
        doctorId: "",
        referenceNumber: "",
        ...(prev[listingId] || {}),
        [field]: value,
      },
    }));
  };

  useEffect(() => {
    if (!open) return;
    setStep("search");
    setBrowseMode("equipment");
    setSearch("");
    setDebouncedSearch("");
    setCategoryFilter(undefined);
    setCategoriesExpanded(false);
    setCart([]);
    setSelected(null);
    setDetail(null);
    setQuantity("1");
    setRentalDays("7");
    setVariantId("");
    setDeliveryOption("standard");
    setMedicalRefs({});
    setPlaceErrors([]);
    setPlacedOrders([]);
    const def = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
    setAddressId(def?.id ?? "");
  }, [open, customer]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open || step === "cart") return;
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const rows = await adminApi.searchOrderableListings(
          debouncedSearch || undefined,
          ADMIN_BROWSE_LISTING_LIMIT,
          browseMode === "chemicals",
        );
        if (!cancelled) setResults(rows);
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          toast.error(e instanceof Error ? e.message : "Failed to search listings");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, debouncedSearch, step, browseMode]);

  const variants = useMemo(() => (detail?.variants ?? []).filter((v) => v.isActive), [detail]);
  const selectedVariant: ProductVariantDto | undefined = useMemo(
    () => variants.find((v) => v.id === variantId),
    [variants, variantId],
  );

  const rentEnabled = detail?.isRentEnabled ?? selected?.isRentEnabled ?? true;
  const buyEnabled = detail?.isBuyEnabled ?? selected?.isBuyEnabled ?? false;
  const isChemical = detail?.isChemical ?? selected?.isChemical ?? false;

  const configureEstimate = useMemo(() => {
    const qty = Math.max(1, Number(quantity) || 1);
    const days = Math.max(0, Number(rentalDays) || 0);
    if (orderType === "buy") {
      const unit = selectedVariant?.buyPrice ?? detail?.buyPrice ?? selected?.buyPrice ?? 0;
      return unit * qty;
    }
    const daily = detail?.dailyRent ?? selected?.dailyRent ?? 0;
    return daily * Math.max(1, days) * qty;
  }, [orderType, quantity, rentalDays, selectedVariant, detail, selected]);

  const cartTotal = useMemo(() => cart.reduce((sum, line) => sum + lineEstimate(line), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  useEffect(() => {
    setCategoryFilter(undefined);
  }, [browseMode, debouncedSearch]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results) {
      const name = r.categoryName?.trim() || "General";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const categoryCounts = useMemo(() => Object.fromEntries(categories), [categories]);
  const categoryNames = useMemo(() => categories.map(([name]) => name), [categories]);
  const singleCategoryLabel = categoryNames.length === 1 ? categoryNames[0] : undefined;

  useEffect(() => {
    if (debouncedSearch) {
      setCategoriesExpanded(false);
      return;
    }
    if (categoryNames.length > 5) setCategoriesExpanded(true);
  }, [debouncedSearch, categoryNames.length]);

  const visibleResults = useMemo(() => {
    if (!categoryFilter) return results;
    return results.filter((r) => (r.categoryName?.trim() || "General") === categoryFilter);
  }, [results, categoryFilter]);

  const stepHint =
    step === "search"
      ? browseMode === "chemicals"
        ? "Browse chemicals for purchase, add items to cart, then place the order."
        : "Browse equipment for rent/buy, add items to cart, then place the order."
      : step === "configure"
        ? "Set quantity and options, then add this item to the cart."
        : step === "success"
          ? "Orders were submitted successfully."
          : "Review cart items, choose delivery, and place the order.";

  const prescriptionLines = useMemo(
    () => cart.filter((l) => l.prescriptionRequired),
    [cart],
  );

  const pickListing = async (listing: AdminOrderableListingDto) => {
    if (listing.availableQuantity <= 0) {
      toast.error("This listing is out of stock");
      return;
    }
    setSelected(listing);
    setStep("configure");
    setLoadingDetail(true);
    setDetail(null);
    setVariantId("");
    setQuantity("1");
    setRentalDays("7");
    try {
      const d = await customerApi.getListingDetail(listing.listingId);
      setDetail(d);
      const canRent = d.isRentEnabled !== false;
      const canBuy = d.isBuyEnabled === true;
      if (d.isChemical || (canBuy && !canRent)) setOrderType("buy");
      else setOrderType("rent");
      const active = (d.variants ?? []).filter((v) => v.isActive);
      if (active.length === 1) setVariantId(active[0].id);
      else if (active.length > 1) {
        const withStock = active.find((v) => (v.availableQuantity ?? 0) > 0);
        setVariantId(withStock?.id ?? active[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load listing details");
      if (listing.isChemical || (listing.isBuyEnabled && !listing.isRentEnabled)) setOrderType("buy");
      else setOrderType("rent");
    } finally {
      setLoadingDetail(false);
    }
  };

  const addToCart = (andContinue: boolean) => {
    if (!selected) return;
    if (orderType === "rent" && (!Number(rentalDays) || Number(rentalDays) < 1)) {
      toast.error("Rental days must be at least 1");
      return;
    }
    if (variants.length > 0 && !variantId) {
      toast.error("Select a packaging size / variant");
      return;
    }
    if (orderType === "rent" && !rentEnabled) {
      toast.error("Rent is not enabled for this product");
      return;
    }
    if (orderType === "buy" && !buyEnabled) {
      toast.error("Buy is not enabled for this product");
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const days = orderType === "rent" ? Math.max(1, Number(rentalDays) || 1) : 0;
    const buyUnit = selectedVariant?.buyPrice ?? detail?.buyPrice ?? selected.buyPrice;
    const variantLabel = selectedVariant
      ? `${selectedVariant.sizeValue} ${selectedVariant.sizeUnit}${selectedVariant.sku ? ` · ${selectedVariant.sku}` : ""}`
      : undefined;
    const key = cartKey(selected.listingId, variantId || undefined);
    const image = resolveItemImageUrl({
      primaryImageUrl: detail?.imageUrls?.[0] ?? selected.primaryImageUrl,
      imageUrls: detail?.imageUrls,
    });

    setCart((prev) => {
      const ix = prev.findIndex((l) => l.key === key);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = {
          ...next[ix],
          quantity: next[ix].quantity + qty,
          rentalDays: days,
          orderType,
          buyPrice: buyUnit,
          dailyRent: detail?.dailyRent ?? selected.dailyRent,
          title: selected.title,
          vendorName: selected.vendorName,
          primaryImageUrl: image,
          variantLabel,
          prescriptionRequired:
            !!detail?.prescriptionRequired || !!selected.prescriptionRequired || next[ix].prescriptionRequired,
          isChemical: selected.isChemical || !!detail?.isChemical,
        };
        return next;
      }
      return [
        ...prev,
        {
          key,
          listingId: selected.listingId,
          title: selected.title,
          vendorName: selected.vendorName,
          categoryName: selected.categoryName,
          isChemical: selected.isChemical || !!detail?.isChemical,
          prescriptionRequired: !!detail?.prescriptionRequired || !!selected.prescriptionRequired,
          primaryImageUrl: image,
          quantity: qty,
          rentalDays: days,
          orderType,
          productVariantId: variantId || undefined,
          variantLabel,
          dailyRent: detail?.dailyRent ?? selected.dailyRent,
          buyPrice: buyUnit,
        },
      ];
    });

    toast.success(andContinue ? "Added to cart — keep shopping" : "Added to cart");
    setSelected(null);
    setDetail(null);
    setPlaceErrors([]);
    if (andContinue) {
      setStep("search");
    } else {
      setStep("cart");
    }
  };

  const updateCartLine = (key: string, patch: Partial<Pick<AdminCartLine, "quantity" | "rentalDays">>) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        next.quantity = Math.max(1, next.quantity);
        if (next.orderType === "rent") next.rentalDays = Math.max(1, next.rentalDays);
        else next.rentalDays = 0;
        return next;
      }),
    );
  };

  const removeCartLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      toast.error("Add at least one item to the cart");
      return;
    }
    if (!addressId) {
      toast.error("Select a delivery address");
      return;
    }
    for (const line of cart) {
      if (line.orderType === "rent" && line.rentalDays < 1) {
        toast.error(`Set rental days for “${line.title}”`);
        return;
      }
    }
    // Doctor reference is optional (Admin-curated Unique ID flow). Hospital is no longer used.

    setSaving(true);
    setPlaceErrors([]);
    try {
      const result = await adminApi.placeOrderForCustomer(customerId, {
        customerAddressId: addressId,
        deliveryOption,
        lines: cart.map((line) => {
          const ref = medicalRefs[line.listingId];
          return {
            listingId: line.listingId,
            quantity: line.quantity,
            rentalDays: line.orderType === "rent" ? line.rentalDays : 0,
            orderType: line.orderType,
            productVariantId: line.productVariantId,
            doctorId: line.prescriptionRequired ? ref?.doctorId : undefined,
            hospitalId: line.prescriptionRequired ? ref?.hospitalId : undefined,
            referenceNumber: line.prescriptionRequired ? ref?.referenceNumber || undefined : undefined,
          };
        }),
      });

      const placed = result.placedOrders ?? [];
      const failed = result.failedLines ?? [];
      if (failed.length > 0 && placed.length === 0) {
        setPlaceErrors(failed.map((f) => f.message || "Order line failed"));
        toast.error(failed[0]?.message || "Order placement failed");
        return;
      }

      if (failed.length > 0) {
        setPlaceErrors(failed.map((f) => f.message || "Some lines failed"));
        toast.warning(`Placed ${placed.length}; ${failed.length} line(s) failed`);
      }

      setPlacedOrders(placed);
      setCart((prev) => {
        if (failed.length === 0) return [];
        const failedIds = new Set(failed.map((f) => f.listingId));
        return prev.filter((l) => failedIds.has(l.listingId));
      });
      setStep("success");
      onPlaced();
    } catch (e) {
      const msg = getUserFriendlyMessage(e);
      setPlaceErrors([msg]);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const imageUrl = resolveItemImageUrl({
    primaryImageUrl: detail?.imageUrls?.[0] ?? selected?.primaryImageUrl,
    imageUrls: detail?.imageUrls,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-1">
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Create order for {customer.fullName}
            </DialogTitle>
            {cartCount > 0 && step !== "cart" && step !== "success" && (
              <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => setStep("cart")}>
                <ShoppingCart className="h-4 w-4 mr-1.5" />
                Cart ({cartCount})
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-normal">{stepHint}</p>
          {step !== "success" && (
            <div className="flex items-center gap-2 pt-1">
              {(["search", "configure", "cart"] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/40 text-xs">›</span>}
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      step === s ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s === "search" ? "1. Browse" : s === "configure" ? "2. Add item" : "3. Review & place"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {step === "search" && (
            <>
              <div
                className="inline-flex w-full rounded-xl bg-muted p-1"
                role="tablist"
                aria-label="Product type"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={browseMode === "equipment"}
                  onClick={() => setBrowseMode("equipment")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5",
                    browseMode === "equipment"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Package className="h-4 w-4" />
                  Equipment
                  {browseMode === "equipment" && !searching && (
                    <span className="text-[11px] font-medium text-muted-foreground">({visibleResults.length})</span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={browseMode === "chemicals"}
                  onClick={() => setBrowseMode("chemicals")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5",
                    browseMode === "chemicals"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FlaskConical className="h-4 w-4" />
                  Chemicals
                  {browseMode === "chemicals" && !searching && (
                    <span className="text-[11px] font-medium text-muted-foreground">({visibleResults.length})</span>
                  )}
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    browseMode === "chemicals"
                      ? "Search acids, reagents, solvents, vendor…"
                      : "Search beds, oxygen, wheelchairs, vendor…"
                  }
                />
              </div>

              {!searching && results.length > 0 && categoryNames.length > 0 ? (
                singleCategoryLabel ? (
                  <p className="text-xs text-muted-foreground">
                    Category:{" "}
                    <span className="font-medium text-foreground">{singleCategoryLabel}</span> (
                    {categoryCounts[singleCategoryLabel] ?? results.length})
                  </p>
                ) : categoryNames.length <= 5 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(undefined)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        categoryFilter === undefined
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      All ({results.length})
                    </button>
                    {categories.map(([name, count]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCategoryFilter(name)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          categoryFilter === name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {name} ({count})
                      </button>
                    ))}
                  </div>
                ) : !categoriesExpanded ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      Category:{" "}
                      <span className="font-medium text-foreground">
                        {categoryFilter ?? "All categories"}
                      </span>
                      {" · "}
                      {visibleResults.length} items
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 text-xs"
                      onClick={() => setCategoriesExpanded(true)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
                    <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Categories ({categoryNames.length})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCategoriesExpanded(false)}
                      >
                        Collapse
                      </Button>
                    </div>
                    <FilterCategoryList
                      options={categoryNames}
                      counts={categoryCounts}
                      allCount={results.length}
                      value={categoryFilter}
                      onChange={(name) => {
                        setCategoryFilter(name);
                        setCategoriesExpanded(false);
                      }}
                      active={open && step === "search"}
                      compact
                      searchThreshold={8}
                      listClassName="max-h-[min(10rem,24vh)]"
                    />
                  </div>
                )
              ) : null}

              {!searching && results.length >= ADMIN_BROWSE_LISTING_LIMIT ? (
                <p className="text-[11px] text-muted-foreground">
                  Showing the first {ADMIN_BROWSE_LISTING_LIMIT}{" "}
                  {browseMode === "chemicals" ? "chemical" : "equipment"} listings — use search or category to narrow
                  further.
                </p>
              ) : null}

              {searching ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center space-y-2">
                  {browseMode === "chemicals"
                    ? <FlaskConical className="h-8 w-8 mx-auto text-violet-300" />
                    : <Package className="h-8 w-8 mx-auto text-teal-300" />}
                  <p className="text-sm font-medium">
                    No {browseMode === "chemicals" ? "chemicals" : "equipment"} found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try another search{browseMode === "chemicals" ? ", or switch to Equipment" : ", or switch to Chemicals"}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {browseMode === "chemicals" ? "Chemicals for purchase" : "Equipment for rent / buy"}
                    {" · "}
                    {visibleResults.length}
                    {cartCount > 0 ? ` · ${cartCount} in cart` : ""}
                  </p>
                  <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                    {visibleResults.map((row) => {
                      const img = resolveItemImageUrl({ primaryImageUrl: row.primaryImageUrl });
                      const disabled = row.availableQuantity <= 0;
                      const alreadyInCart = cart.some((c) => c.listingId === row.listingId);
                      return (
                        <button
                          key={row.listingId}
                          type="button"
                          disabled={disabled}
                          onClick={() => pickListing(row)}
                          className={cn(
                            "w-full flex gap-3 rounded-lg border p-3 text-left transition-colors",
                            row.isChemical
                              ? "border-violet-100 hover:border-violet-300 hover:bg-violet-50/40"
                              : "border-teal-100 hover:border-teal-300 hover:bg-teal-50/40",
                            disabled && "opacity-50 cursor-not-allowed bg-muted/20 hover:bg-muted/20 hover:border-border",
                          )}
                        >
                          <div className="h-14 w-14 rounded-md border bg-muted/40 overflow-hidden shrink-0">
                            <ListingThumb src={img} isChemical={row.isChemical} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm truncate">{row.title}</p>
                              {typeBadge(row.isChemical)}
                              {alreadyInCart && (
                                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-200">In cart</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {row.vendorName} · {row.categoryName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium tabular-nums">{priceHint(row, browseMode)}</span>
                              {stockBadge(row.availabilityStatus, row.availableQuantity)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "configure" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() => {
                  setStep("search");
                  setSelected(null);
                  setDetail(null);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to search
              </Button>

              {selected && (
                <div className={cn(
                  "flex gap-3 rounded-lg border p-3",
                  selected.isChemical ? "bg-violet-50/40 border-violet-100" : "bg-teal-50/40 border-teal-100",
                )}>
                  <div className="h-16 w-16 rounded-md border bg-background overflow-hidden shrink-0">
                    <ListingThumb src={imageUrl} isChemical={selected.isChemical} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">{selected.title}</p>
                      {typeBadge(selected.isChemical)}
                    </div>
                    <p className="text-xs text-muted-foreground">{selected.vendorName} · {selected.categoryName}</p>
                    {loadingDetail ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading details…
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {rentEnabled && <Badge variant="outline" className="text-[10px]">Rent available</Badge>}
                        {buyEnabled && <Badge variant="outline" className="text-[10px]">Buy available</Badge>}
                        {stockBadge(
                          detail?.availabilityStatus ?? selected.availabilityStatus,
                          detail?.availableQuantity ?? selected.availableQuantity,
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Order type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={orderType === "rent" ? "default" : "outline"}
                      size="sm"
                      disabled={!rentEnabled || isChemical}
                      onClick={() => setOrderType("rent")}
                      className="flex-1"
                    >
                      {orderType === "rent" && <Check className="h-3.5 w-3.5 mr-1.5" />}
                      Rent
                    </Button>
                    <Button
                      type="button"
                      variant={orderType === "buy" ? "default" : "outline"}
                      size="sm"
                      disabled={!buyEnabled}
                      onClick={() => setOrderType("buy")}
                      className="flex-1"
                    >
                      {orderType === "buy" && <Check className="h-3.5 w-3.5 mr-1.5" />}
                      Buy
                    </Button>
                  </div>
                </div>

                {variants.length > 0 && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Packaging / size</Label>
                    <Select value={variantId} onValueChange={setVariantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.sizeValue} {v.sizeUnit}
                            {v.sku ? ` · ${v.sku}` : ""}
                            {` · ${formatMoney(v.buyPrice)}`}
                            {typeof v.availableQuantity === "number" ? ` · ${v.availableQuantity} in stock` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>

                {orderType === "rent" && (
                  <div className="space-y-1.5">
                    <Label>Rental days</Label>
                    <Input type="number" min={1} value={rentalDays} onChange={(e) => setRentalDays(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Estimated for this item</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(configureEstimate)}</p>
              </div>
            </>
          )}

          {step === "cart" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => setStep("search")}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add more items
                </Button>
                {cart.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setCart([])}>
                    Clear cart
                  </Button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center space-y-3">
                  <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">Cart is empty</p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setStep("search")}>
                    Browse products
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const equipment = cart.filter((l) => !l.isChemical);
                    const chemicals = cart.filter((l) => l.isChemical);
                    return (
                      <>
                        {placeErrors.length > 0 && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 space-y-1.5">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold text-destructive">Could not place order</p>
                                {placeErrors.map((err, i) => (
                                  <p key={i} className="text-xs text-destructive/90 leading-relaxed">{err}</p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {equipment.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-0.5">
                              <Package className="h-3.5 w-3.5 text-teal-600" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                                Equipment · {equipment.length}
                              </p>
                            </div>
                            {equipment.map((line) => (
                              <CartItemTile
                                key={line.key}
                                line={line}
                                onUpdate={updateCartLine}
                                onRemove={removeCartLine}
                              />
                            ))}
                          </div>
                        )}
                        {chemicals.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-0.5">
                              <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
                                Chemicals · {chemicals.length}
                              </p>
                            </div>
                            {chemicals.map((line) => (
                              <CartItemTile
                                key={line.key}
                                line={line}
                                onUpdate={updateCartLine}
                                onRemove={removeCartLine}
                              />
                            ))}
                          </div>
                        )}

                        {prescriptionLines.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-amber-900">Doctor reference (optional)</p>
                                <p className="text-xs text-amber-800/90 mt-0.5">
                                  Doctors are managed under Catalog → Doctor References. Customers will attach a doctor by Unique ID at checkout (optional). Hospital selection has been removed.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="grid gap-4 sm:grid-cols-2 pt-1">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Delivery address</Label>
                      {customer.addresses.length === 0 ? (
                        <p className="text-sm text-destructive">
                          This customer has no saved address. Add one before placing an order.
                        </p>
                      ) : (
                        <Select value={addressId} onValueChange={setAddressId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select address" />
                          </SelectTrigger>
                          <SelectContent>
                            {customer.addresses.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.label ? `${a.label}: ` : ""}{a.line1}, {a.city}
                                {a.isDefault ? " (default)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Delivery option</Label>
                      <Select value={deliveryOption} onValueChange={setDeliveryOption}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="express">Express</SelectItem>
                          <SelectItem value="pickup">Pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 px-4 py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Estimated total · {cart.length} item{cart.length === 1 ? "" : "s"}
                      </p>
                      <p className="text-xl font-bold tabular-nums tracking-tight">{formatMoney(cartTotal)}</p>
                      <p className="text-[11px] text-muted-foreground">Taxes and fees may apply at placement.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === "success" && (
            <div className="py-6 space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {placedOrders.length > 0 ? "Order placed successfully" : "Order submitted"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {placedOrders.length > 0
                    ? `${placedOrders.length} order${placedOrders.length === 1 ? "" : "s"} created for ${customer.fullName}.`
                    : `Orders for ${customer.fullName} were processed.`}
                </p>
              </div>
              {placedOrders.length > 0 && (
                <div className="rounded-xl border bg-muted/20 text-left divide-y max-w-sm mx-auto">
                  {placedOrders.map((o) => (
                    <div key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums">{o.orderNumber}</span>
                      {o.listingTitle && (
                        <span className="text-xs text-muted-foreground truncate max-w-[55%]">{o.listingTitle}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {placeErrors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3 text-left space-y-1 max-w-sm mx-auto">
                  <p className="text-sm font-medium text-amber-900">Some items still need attention</p>
                  {placeErrors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-800">{err}</p>
                  ))}
                  {cart.length > 0 && (
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setStep("cart")}>
                      Fix remaining items
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 gap-2">
          {step === "success" ? (
            <>
              {cart.length > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep("cart")}>
                  Review remaining
                </Button>
              )}
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="min-w-[8rem]"
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {step === "configure" && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingDetail}
                    onClick={() => addToCart(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add & keep shopping
                  </Button>
                  <Button type="button" disabled={loadingDetail} onClick={() => addToCart(false)}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to cart
                  </Button>
                </>
              )}
              {step === "search" && cartCount > 0 && (
                <Button type="button" onClick={() => setStep("cart")}>
                  Review cart ({cartCount})
                </Button>
              )}
              {step === "cart" && (
                <Button
                  onClick={placeOrder}
                  disabled={saving || cart.length === 0 || customer.addresses.length === 0}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                  Place order{cart.length > 0 ? ` (${cart.length})` : ""}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
