import { useState, useEffect, useMemo, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ImageOff, MapPin } from "lucide-react";
import { customerApi } from "@/app/services/customerApi";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/helpers/utils";
import { useAuth } from "@/app/guards/AuthContext";
import {
  ActiveFilterChips,
  FilterCategoryList,
  FilterPanel,
  FilterSearchBar,
  FilterSection,
  FilterTileGrid,
  type ActiveFilterChip,
} from "@/app/components/shared/ProfessionalFilters";

import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/** Filters by inventory level on active listings (not listing active/inactive). */
type StockFilter = "all" | "low_stock" | "out_of_stock";

function isActiveCatalogListing(listingStatus: string): boolean {
  const status = listingStatus.trim().toLowerCase();
  return status === "active" || status === "approved";
}

export function availabilityBadge(
  status: string,
  qty: number,
  totalAcrossVendors: number,
  listingStatus: string,
): { label: string; className: string } | null {
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
  // In-stock / available: no badge per product requirement
  return null;
}

/** Fits the whole image inside a fixed aspect-ratio frame (letterboxing on sides or top/bottom). */
export function BrowseCardImage({ src }: { src: string }) {
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
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [browseMode, setBrowseMode] = useState<"equipment" | "chemicals">("equipment");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string | undefined>(undefined);
  const [draftStock, setDraftStock] = useState<StockFilter>("all");
  const [draftFavorites, setDraftFavorites] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: favoritesData = [] } = useQuery({
    queryKey: ["customer-favorites"],
    queryFn: () => customerApi.getFavorites(),
    enabled: user?.role === "customer",
  });

  const wishlist = useMemo(() => new Set(favoritesData.map(f => f.vendorProductListingId)), [favoritesData]);

  const addFavoriteMutation = useMutation({
    mutationFn: (listingId: string) => customerApi.addFavorite(listingId),
    onMutate: async (listingId) => {
      await queryClient.cancelQueries({ queryKey: ["customer-favorites"] });
      const previous = queryClient.getQueryData<any[]>(["customer-favorites"]);
      queryClient.setQueryData<any[]>(["customer-favorites"], (old = []) => {
        if (old.some(f => f.vendorProductListingId === listingId)) return old;
        return [...old, { id: "temp-" + listingId, vendorProductListingId: listingId }];
      });
      return { previous };
    },
    onError: (err, newTodo, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["customer-favorites"], context.previous);
      }
      toast.error("Failed to add favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-favorites"] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (listingId: string) => customerApi.removeFavorite(listingId),
    onMutate: async (listingId) => {
      await queryClient.cancelQueries({ queryKey: ["customer-favorites"] });
      const previous = queryClient.getQueryData<any[]>(["customer-favorites"]);
      queryClient.setQueryData<any[]>(["customer-favorites"], (old = []) => 
        old.filter(f => f.vendorProductListingId !== listingId)
      );
      return { previous };
    },
    onError: (err, newTodo, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["customer-favorites"], context.previous);
      }
      toast.error("Failed to remove favorite");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-favorites"] });
    },
  });

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
    queryKey: ["customer-catalog", debouncedSearch],
    queryFn: () => customerApi.getCatalogListings(undefined, debouncedSearch),
  });

  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ["customer-addresses", user?.id],
    queryFn: () => customerApi.getAddresses(),
    enabled: user?.role === "customer",
  });

  const hasGeoAddress = useMemo(
    () =>
      addresses.some(
        (a) =>
          typeof a.latitude === "number" &&
          typeof a.longitude === "number" &&
          !(a.latitude === 0 && a.longitude === 0),
      ),
    [addresses],
  );

  useEffect(() => {
    if (user?.role !== "customer" || addressesLoading) {
      return;
    }

    // Session snooze only — never permanently block users with zero addresses.
    // Clear legacy permanent dismiss keys from older builds.
    if (hasGeoAddress) {
      sessionStorage.removeItem("locationPromptDismissed");
      setShowLocationPrompt(false);
      return;
    }

    sessionStorage.removeItem("locationPromptDismissed");
    const snoozed = sessionStorage.getItem("locationPromptSnoozed") === "true";
    setShowLocationPrompt(!snoozed);
  }, [addresses, hasGeoAddress, user?.role, addressesLoading]);

  const handleDismissPrompt = () => {
    sessionStorage.setItem("locationPromptSnoozed", "true");
    setShowLocationPrompt(false);
  };

  const categoryPills = useMemo(() => {
    const modeCategories = categories.filter((c) =>
      browseMode === "chemicals" ? !!c.isChemical : !c.isChemical,
    );
    return ["All", ...modeCategories.map((c) => c.categoryName)];
  }, [categories, browseMode]);
  const stockPills: Array<{ id: StockFilter; label: string }> = [
    { id: "all", label: "All stock" },
    { id: "low_stock", label: "Low stock" },
    { id: "out_of_stock", label: "Out of stock" },
  ];
  /** Active listings for the current tab (+ stock/favorites); category applied separately for the grid. */
  const catalogBeforeCategory = useMemo(() => {
    if (!data) return [];
    let result = data.filter((item) => isActiveCatalogListing(item.listingStatus));
    if (browseMode === "equipment") {
      result = result.filter((item) => item.baseUnit == null);
    } else {
      result = result.filter((item) => item.baseUnit != null);
    }
    if (stockFilter !== "all") {
      result = result.filter((item) => item.availabilityStatus.toLowerCase() === stockFilter);
    }
    if (showFavoritesOnly) {
      result = result.filter((item) => wishlist.has(item.id));
    }
    return result;
  }, [data, stockFilter, showFavoritesOnly, wishlist, browseMode]);

  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of catalogBeforeCategory) {
      const name = item.categoryName?.trim();
      if (!name) continue;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [catalogBeforeCategory]);

  const filteredData = useMemo(() => {
    if (!appliedCat) return catalogBeforeCategory;
    return catalogBeforeCategory.filter((item) => item.categoryName === appliedCat);
  }, [catalogBeforeCategory, appliedCat]);

  // Drop category selection when switching tabs if it doesn't belong to the new mode.
  useEffect(() => {
    if (!appliedCat) return;
    const stillValid = categories.some(
      (c) =>
        c.categoryName === appliedCat &&
        (browseMode === "chemicals" ? !!c.isChemical : !c.isChemical),
    );
    if (!stillValid) setAppliedCat(undefined);
  }, [browseMode, categories, appliedCat]);

  const toggleWishlist = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.role !== "customer") {
      toast.message("Sign in to save favorites");
      navigate("/customer/login", { state: { from: "/customer/shop" } });
      return;
    }
    if (wishlist.has(id)) {
      removeFavoriteMutation.mutate(id);
    } else {
      addFavoriteMutation.mutate(id);
    }
  };

  const openFilters = () => {
    setDraftCategory(appliedCat);
    setDraftStock(stockFilter);
    setDraftFavorites(showFavoritesOnly);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setAppliedCat(draftCategory);
    setStockFilter(draftStock);
    setShowFavoritesOnly(draftFavorites);
  };

  const resetDraftFilters = () => {
    setDraftCategory(undefined);
    setDraftStock("all");
    setDraftFavorites(false);
  };

  const clearAllFilters = () => {
    setAppliedCat(undefined);
    setStockFilter("all");
    setShowFavoritesOnly(false);
  };

  const activeFilterCount =
    (appliedCat ? 1 : 0) + (stockFilter !== "all" ? 1 : 0) + (showFavoritesOnly ? 1 : 0);

  const activeChips: ActiveFilterChip[] = [];
  if (appliedCat) {
    activeChips.push({
      key: "category",
      label: appliedCat,
      onClear: () => setAppliedCat(undefined),
    });
  }
  if (stockFilter !== "all") {
    const label = stockPills.find((p) => p.id === stockFilter)?.label ?? stockFilter;
    activeChips.push({
      key: "stock",
      label,
      onClear: () => setStockFilter("all"),
    });
  }
  if (showFavoritesOnly) {
    activeChips.push({
      key: "favorites",
      label: "Favorites",
      onClear: () => setShowFavoritesOnly(false),
    });
  }

  const modeCategoryNames = categoryPills.filter((label) => label !== "All");

  return (
    <div className="space-y-5">
      {user?.role === "customer" && !addressesLoading && !hasGeoAddress && (
        <Link
          to="/customer/addresses"
          className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Add delivery address</span>
            <span className="block text-xs text-muted-foreground">
              Needed for checkout and accurate delivery charges.
            </span>
          </span>
          <span className="text-sm font-medium text-primary">Set now</span>
        </Link>
      )}

      {/* Storefront controls */}
      <div className="rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div
            className="inline-flex w-full shrink-0 rounded-xl bg-muted p-1 lg:w-auto"
            role="tablist"
            aria-label="Shop category"
          >
            <button
              type="button"
              role="tab"
              aria-selected={browseMode === "equipment"}
              onClick={() => setBrowseMode("equipment")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all lg:flex-none",
                browseMode === "equipment"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Equipment Rentals
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={browseMode === "chemicals"}
              onClick={() => setBrowseMode("chemicals")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all lg:flex-none",
                browseMode === "chemicals"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Chemicals (Buy)
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <FilterSearchBar
              value={searchInput}
              onChange={setSearchInput}
              placeholder={
                browseMode === "chemicals"
                  ? "Search acids, reagents, solvents..."
                  : "Search beds, oxygen, wheelchairs..."
              }
              activeCount={activeFilterCount}
              onOpenFilters={openFilters}
              aria-label="Search listings"
            />
          </div>
        </div>

        {(activeChips.length > 0 || (!isLoading && filteredData.length > 0)) && (
          <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                "Loading products…"
              ) : (
                <>
                  <span className="font-medium text-foreground">{filteredData.length}</span>
                  {` ${filteredData.length === 1 ? "product" : "products"}`}
                  {browseMode === "chemicals" ? " for purchase" : " for rent"}
                  {appliedCat ? (
                    <>
                      {" "}
                      in <span className="font-medium text-foreground">{appliedCat}</span>
                    </>
                  ) : null}
                </>
              )}
            </p>
            <ActiveFilterChips chips={activeChips} onClearAll={clearAllFilters} clearLabel="Clear all" />
          </div>
        )}
      </div>

      <FilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filters"
        description="Filter by stock level, category, and saved items. Only active listings are shown."
        onReset={resetDraftFilters}
        resetLabel="Clear all"
        onApply={applyFilters}
        applyLabel={
          (draftCategory ? 1 : 0) + (draftStock !== "all" ? 1 : 0) + (draftFavorites ? 1 : 0) > 0
            ? `Show results (${(draftCategory ? 1 : 0) + (draftStock !== "all" ? 1 : 0) + (draftFavorites ? 1 : 0)})`
            : "Show results"
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
          <FilterSection title="Stock" className="shrink-0">
            <FilterTileGrid
              options={stockPills}
              value={draftStock}
              onChange={(id) => setDraftStock(id as StockFilter)}
            />
          </FilterSection>

          <FilterSection title="Saved" className="shrink-0">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <Label htmlFor="browse-favorites" className="text-sm font-medium">
                Favorites only
              </Label>
              <Switch
                id="browse-favorites"
                checked={draftFavorites}
                onCheckedChange={(checked) => {
                  if (checked && !user) {
                    toast.error("Please log in to see your saved items.");
                    return;
                  }
                  setDraftFavorites(checked);
                }}
              />
            </div>
          </FilterSection>

          <FilterSection
            title="Category"
            hint={catLoading ? undefined : `${modeCategoryNames.length} categories`}
            fill
            className="min-h-0"
          >
            {catLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <FilterCategoryList
                options={modeCategoryNames}
                counts={categoryItemCounts}
                allCount={catalogBeforeCategory.length}
                value={draftCategory}
                onChange={setDraftCategory}
                active={filtersOpen}
              />
            )}
          </FilterSection>
        </div>
      </FilterPanel>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load catalog."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border/70 shadow-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <CardHeader className="space-y-2 px-4 pb-2 pt-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          filteredData.map((item) => {
            const ls = item.listingStatus.trim().toLowerCase();
            const isBrowsable = ls === "active" || ls === "approved";
            const isChem = !!item.isChemical;
            const showRent = !isChem && (item.isRentEnabled ?? true);
            const showBuy = isChem || !!item.isBuyEnabled;
            const badge = availabilityBadge(
              item.availabilityStatus,
              item.availableQuantity,
              item.productTotalAvailableQuantity,
              item.listingStatus,
            );

            const primaryPrice = (() => {
              if (showRent) {
                const daily = item.dailyRent ?? 0;
                const weekly = item.weeklyRent ?? 0;
                const monthly = item.monthlyRent ?? 0;
                // Latest flow: lead with day rate (derive from weekly when daily unset)
                const dayRate = daily > 0 ? daily : weekly > 0 ? weekly / 7 : 0;
                if (dayRate > 0) {
                  return { value: `₹${Math.round(dayRate).toLocaleString("en-IN")}`, unit: "/day" };
                }
                if (monthly > 0) {
                  return { value: `₹${monthly.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, unit: "/month" };
                }
              }
              if (showBuy && item.buyPrice != null && item.buyPrice > 0) {
                return {
                  value: `₹${item.buyPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                  unit: item.baseUnit ? ` / ${item.baseUnit}` : "",
                };
              }
              return null;
            })();

            return (
              <Card
                key={item.id}
                className="group flex flex-col overflow-hidden border-border/70 p-0 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <div className="relative">
                  {isBrowsable ? (
                    <Link
                      to={`/customer/shop/${item.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                        <BrowseCardImage src={item.primaryImageUrl ?? ""} />
                        {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
                      </div>
                    </Link>
                  ) : (
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                      <BrowseCardImage src={item.primaryImageUrl ?? ""} />
                      {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
                    </div>
                  )}
                  {item.listingStatus !== "product_only" && (
                    <button
                      type="button"
                      aria-label={wishlist.has(item.id) ? "Remove from wishlist" : "Save to wishlist"}
                      onClick={(e) => toggleWishlist(item.id, e)}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/95 shadow-sm ring-1 ring-border/60 backdrop-blur-sm transition-colors hover:bg-background"
                    >
                      <Heart
                        className={cn(
                          "h-4 w-4",
                          wishlist.has(item.id)
                            ? "fill-destructive text-destructive"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                  )}
                </div>

                <CardHeader className="space-y-2 px-4 pb-1 pt-4">
                  {isBrowsable ? (
                    <Link
                      to={`/customer/shop/${item.id}`}
                      className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug tracking-tight group-hover:text-primary">
                        {item.title}
                      </p>
                    </Link>
                  ) : (
                    <p className="line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug tracking-tight">
                      {item.title}
                    </p>
                  )}

                  {primaryPrice ? (
                    <p className="flex items-baseline gap-1">
                      <span className="text-lg font-bold tabular-nums tracking-tight">
                        {primaryPrice.value}
                      </span>
                      <span className="text-xs text-muted-foreground">{primaryPrice.unit}</span>
                    </p>
                  ) : null}
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-3 pt-0">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {showRent && (
                      <p className="tabular-nums">
                        {/* Day rate is already in the hero price — browse only needs deposit + plan hint */}
                        {item.depositRequired
                          ? `Deposit ₹${item.securityDeposit.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · Plans on details`
                          : "Rental plans on details"}
                      </p>
                    )}
                    {showBuy && showRent && item.buyPrice != null && item.buyPrice > 0 && (
                      <p className="tabular-nums text-emerald-700 dark:text-emerald-400">
                        Also buy for ₹{item.buyPrice.toFixed(0)}
                        {item.maxBuyPrice != null && item.maxBuyPrice > item.buyPrice
                          ? ` – ₹${item.maxBuyPrice.toFixed(0)}`
                          : ""}
                      </p>
                    )}
                    {showBuy && !showRent && item.buyPrice != null && item.buyPrice > 0 && item.maxBuyPrice != null && item.maxBuyPrice > item.buyPrice && (
                      <p className="tabular-nums">Up to ₹{item.maxBuyPrice.toFixed(0)}</p>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="mt-auto border-t border-border/70 bg-muted/20 px-4 py-3">
                  {isBrowsable ? (
                    <Button size="sm" className="w-full bg-gradient-primary shadow-glow hover:opacity-95" asChild>
                      <Link to={`/customer/shop/${item.id}`}>View details</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Not available yet
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
      </div>

      {!isLoading && filteredData.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold">No products found</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try a different search, switch category, or clear filters.
          </p>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearAllFilters}>
              Clear all filters
            </Button>
          )}
        </div>
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
            <Button asChild onClick={handleDismissPrompt}>
              <Link to="/customer/addresses">Set address now</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerBrowse;
