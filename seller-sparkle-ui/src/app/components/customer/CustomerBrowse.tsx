import { useState, useEffect, useMemo, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Heart, ImageOff, Search } from "lucide-react";
import { customerApi } from "@/app/services/customerApi";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { cn } from "@/app/helpers/utils";
import { useAuth } from "@/app/guards/AuthContext";

const WISHLIST_STORAGE_KEY = "prilixor.customer.wishlistIds";
type AvailabilityFilter = "all" | "available" | "low_stock" | "out_of_stock";

function readWishlist(): Set<string> {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeWishlist(ids: Set<string>) {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...ids]));
}

function availabilityBadge(
  status: string,
  qty: number,
  totalAcrossVendors: number,
  listingStatus: string,
): { label: string; className: string } {
  const s = status.trim().toLowerCase();
  const ls = listingStatus.trim().toLowerCase();
  if (ls !== "active" && ls !== "approved") {
    return {
      label: "Unavailable",
      className: "pointer-events-none absolute left-3 top-3 border-0 bg-muted text-foreground hover:bg-muted",
    };
  }
  if (qty <= 0 && totalAcrossVendors > 0) {
    return {
      label: "Out at this vendor",
      className: "pointer-events-none absolute left-3 top-3 border-0 bg-orange-600 text-white hover:bg-orange-600",
    };
  }
  if (s === "out_of_stock" || qty <= 0) {
    return {
      label: "Out of stock",
      className: "pointer-events-none absolute left-3 top-3 border-0 bg-destructive text-white hover:bg-destructive",
    };
  }
  if (qty === 1) {
    return {
      label: "Only 1 left",
      className: "pointer-events-none absolute left-3 top-3 border-0 bg-amber-700 text-white hover:bg-amber-700",
    };
  }
  if (s === "low_stock" || qty <= 3) {
    return {
      label: "Limited stock",
      className: "pointer-events-none absolute left-3 top-3 border-0 bg-amber-600 text-white hover:bg-amber-600",
    };
  }
  return {
    label: "Available",
    className: "pointer-events-none absolute left-3 top-3 border-0 bg-emerald-600 text-white hover:bg-emerald-600",
  };
}

/** Fits the whole image inside a fixed aspect-ratio frame (letterboxing on sides or top/bottom). */
function BrowseCardImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src.trim() || failed) {
    const subtitle = !src.trim() ? "Image will be updated soon" : "Image currently unavailable";
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 text-slate-500 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:text-slate-300">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/40 blur-2xl dark:bg-white/10" />
        <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/40 blur-2xl dark:bg-white/10" />
        <div className="relative flex flex-col items-center gap-2 rounded-md border border-white/60 bg-white/55 px-4 py-3 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-black/20">
          <ImageOff className="h-5 w-5" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-200">No product image</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-300">{subtitle}</p>
        </div>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-contain object-center bg-muted"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const CustomerBrowse = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>(undefined);
  const [appliedCat, setAppliedCat] = useState<string | undefined>(undefined);
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [wishlist, setWishlist] = useState<Set<string>>(readWishlist);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = searchInput.trim();
      setDebouncedSearch(q.length ? q : undefined);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ["customer-catalog-categories"],
    queryFn: () => customerApi.getCatalogCategories(),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["customer-catalog", appliedCat, debouncedSearch],
    queryFn: () => customerApi.getCatalogListings(appliedCat, debouncedSearch),
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["customer-addresses", user?.id],
    queryFn: () => customerApi.getAddresses(),
    enabled: user?.role === "customer",
  });

  useEffect(() => {
    if (user?.role !== "customer" || addressesLoading) {
      return;
    }

    const hasGeoAddress = addresses.some((a) => typeof a.latitude === "number" && typeof a.longitude === "number");
    const isDismissed = sessionStorage.getItem("locationPromptDismissed") === "true";
    
    setShowLocationPrompt(!hasGeoAddress && !isDismissed);
  }, [addresses, user?.role, addressesLoading]);

  const handleDismissPrompt = () => {
    sessionStorage.setItem("locationPromptDismissed", "true");
    setShowLocationPrompt(false);
  };

  const categoryPills = useMemo(() => ["All", ...categories.map((c) => c.categoryName)], [categories]);
  const availabilityPills: Array<{ id: AvailabilityFilter; label: string }> = [
    { id: "all", label: "All stock" },
    { id: "available", label: "Available" },
    { id: "low_stock", label: "Low stock" },
    { id: "out_of_stock", label: "Out of stock" },
  ];
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (availabilityFilter === "all") return data;
    return data.filter((item) => item.availabilityStatus.toLowerCase() === availabilityFilter);
  }, [data, availabilityFilter]);

  const toggleWishlist = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeWishlist(next);
      return next;
    });
  };

  const pillSelected = (label: string) =>
    label === "All" ? appliedCat === undefined : appliedCat === label;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse rentals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover gear from verified vendors. Sign in to save addresses and place orders.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search beds, oxygen, wheelchairs..."
          className="pl-9"
          aria-label="Search listings"
        />
      </div>

      <div className="-mx-1 overflow-x-auto px-1 sm:-mx-2 sm:px-2">
        <div className="flex min-h-9 gap-2 pb-1">
          {catLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
              ))
            : categoryPills.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setAppliedCat(label === "All" ? undefined : label)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    pillSelected(label)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              ))}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 sm:-mx-2 sm:px-2">
        <div className="flex min-h-9 gap-2 pb-1">
          {availabilityPills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setAvailabilityFilter(pill.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                availabilityFilter === pill.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-accent",
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load catalog."}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border/80">
              <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-t-lg bg-muted">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-2 pb-3 pt-0">
                <Skeleton className="h-6 w-full" />
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          filteredData.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden border-border/80 p-0 shadow-sm transition hover:shadow-md"
            >
              <div className="relative">
                {(() => {
                  const ls = item.listingStatus.trim().toLowerCase();
                  const isBrowsable = ls === "active" || ls === "approved";
                  return isBrowsable ? (
                    <Link
                      to={`/customer/browse/${item.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-t-lg bg-muted">
                        <BrowseCardImage src={item.primaryImageUrl ?? ""} />
                        {(() => {
                          const badge = availabilityBadge(
                            item.availabilityStatus,
                            item.availableQuantity,
                            item.productTotalAvailableQuantity,
                            item.listingStatus,
                          );
                          return <Badge className={badge.className}>{badge.label}</Badge>;
                        })()}
                      </div>
                    </Link>
                  ) : (
                    <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-t-lg bg-muted">
                      <BrowseCardImage src={item.primaryImageUrl ?? ""} />
                      {(() => {
                        const badge = availabilityBadge(
                          item.availabilityStatus,
                          item.availableQuantity,
                          item.productTotalAvailableQuantity,
                          item.listingStatus,
                        );
                        return <Badge className={badge.className}>{badge.label}</Badge>;
                      })()}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  aria-label={wishlist.has(item.id) ? "Remove from wishlist" : "Save to wishlist"}
                  onClick={(e) => toggleWishlist(item.id, e)}
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
                >
                  <Heart
                    className={cn(
                      "h-4 w-4",
                      wishlist.has(item.id) ? "fill-destructive text-destructive" : "text-muted-foreground",
                    )}
                  />
                </button>
              </div>

              <CardHeader className="space-y-1 px-4 pb-2 pt-4">
                {(() => {
                  const ls = item.listingStatus.trim().toLowerCase();
                  const isBrowsable = ls === "active" || ls === "approved";
                  return isBrowsable ? (
                    <Link
                      to={`/customer/browse/${item.id}`}
                      className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="line-clamp-2 font-semibold leading-snug">{item.title}</p>
                    </Link>
                  ) : (
                    <p className="line-clamp-2 font-semibold leading-snug">{item.title}</p>
                  );
                })()}
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 pt-0">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    ₹{item.dailyRent.toFixed(0)}/day
                  </Badge>
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    ₹{item.monthlyRent.toFixed(0)}/mo
                  </Badge>
                  {item.depositRequired && (
                    <Badge variant="outline" className="font-normal tabular-nums">
                      Deposit ₹{item.securityDeposit.toFixed(0)}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t bg-muted/30 px-4 pb-4 pt-3">
                {(() => {
                  const ls = item.listingStatus.trim().toLowerCase();
                  const isBrowsable = ls === "active" || ls === "approved";
                  return isBrowsable ? (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/customer/browse/${item.id}`}>View details</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Not available yet
                    </Button>
                  );
                })()}
              </CardFooter>
            </Card>
          ))}
      </div>

      {!isLoading && filteredData.length === 0 && (
        <p className="text-sm text-muted-foreground">No listings match your filters.</p>
      )}

      <Dialog open={showLocationPrompt} onOpenChange={(open) => !open && handleDismissPrompt()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set location first</DialogTitle>
            <DialogDescription>
              Add your address with map location to see nearest available products first and get correct delivery charges.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDismissPrompt}>
              Later
            </Button>
            <Button asChild>
              <Link to="/customer/addresses">Set address now</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerBrowse;
