import { useState, useEffect, useMemo, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ImageOff } from "lucide-react";
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
  FilterPanel,
  FilterSearchBar,
  FilterSection,
  FilterSelectRow,
  FilterTileGrid,
  type ActiveFilterChip,
} from "@/app/components/shared/ProfessionalFilters";

import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

type AvailabilityFilter = "all" | "available" | "low_stock" | "out_of_stock";

export function availabilityBadge(
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
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [browseMode, setBrowseMode] = useState<"equipment" | "chemicals">("equipment");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string | undefined>(undefined);
  const [draftAvailability, setDraftAvailability] = useState<AvailabilityFilter>("all");
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

  const categoryPills = useMemo(() => {
    const modeCategories = categories.filter((c) =>
      browseMode === "chemicals" ? !!c.isChemical : !c.isChemical,
    );
    return ["All", ...modeCategories.map((c) => c.categoryName)];
  }, [categories, browseMode]);
  const availabilityPills: Array<{ id: AvailabilityFilter; label: string }> = [
    { id: "all", label: "All stock" },
    { id: "available", label: "Available" },
    { id: "low_stock", label: "Low stock" },
    { id: "out_of_stock", label: "Out of stock" },
  ];
  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data;
    if (browseMode === "equipment") {
      result = result.filter((item) => item.baseUnit == null);
    } else {
      result = result.filter((item) => item.baseUnit != null);
    }
    if (availabilityFilter !== "all") {
      result = result.filter((item) => item.availabilityStatus.toLowerCase() === availabilityFilter);
    }
    if (showFavoritesOnly) {
      result = result.filter((item) => wishlist.has(item.id));
    }
    return result;
  }, [data, availabilityFilter, showFavoritesOnly, wishlist, browseMode]);

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
      navigate("/customer/login", { state: { from: "/customer/browse" } });
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
    setDraftAvailability(availabilityFilter);
    setDraftFavorites(showFavoritesOnly);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setAppliedCat(draftCategory);
    setAvailabilityFilter(draftAvailability);
    setShowFavoritesOnly(draftFavorites);
  };

  const resetDraftFilters = () => {
    setDraftCategory(undefined);
    setDraftAvailability("all");
    setDraftFavorites(false);
  };

  const clearAllFilters = () => {
    setAppliedCat(undefined);
    setAvailabilityFilter("all");
    setShowFavoritesOnly(false);
  };

  const activeFilterCount =
    (appliedCat ? 1 : 0) + (availabilityFilter !== "all" ? 1 : 0) + (showFavoritesOnly ? 1 : 0);

  const activeChips: ActiveFilterChip[] = [];
  if (appliedCat) {
    activeChips.push({
      key: "category",
      label: appliedCat,
      onClear: () => setAppliedCat(undefined),
    });
  }
  if (availabilityFilter !== "all") {
    const label = availabilityPills.find((p) => p.id === availabilityFilter)?.label ?? availabilityFilter;
    activeChips.push({
      key: "availability",
      label,
      onClear: () => setAvailabilityFilter("all"),
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Browse Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover medical equipment and chemicals from verified vendors.
          </p>
        </div>
        
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setBrowseMode("equipment")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              browseMode === "equipment" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            Equipment Rentals
          </button>
          <button
            onClick={() => setBrowseMode("chemicals")}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              browseMode === "chemicals" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            Chemicals (Buy)
          </button>
        </div>
      </div>

      <div className="space-y-3 max-w-2xl">
        <FilterSearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={browseMode === "chemicals" ? "Search acids, reagents, solvents..." : "Search beds, oxygen, wheelchairs..."}
          activeCount={activeFilterCount}
          onOpenFilters={openFilters}
          aria-label="Search listings"
        />
        <ActiveFilterChips chips={activeChips} onClearAll={clearAllFilters} clearLabel="Clear all" />
      </div>

      <FilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filters"
        description="Narrow by category, stock, and saved items."
        onReset={resetDraftFilters}
        resetLabel="Clear all"
        onApply={applyFilters}
        applyLabel={
          (draftCategory ? 1 : 0) + (draftAvailability !== "all" ? 1 : 0) + (draftFavorites ? 1 : 0) > 0
            ? `Show results (${(draftCategory ? 1 : 0) + (draftAvailability !== "all" ? 1 : 0) + (draftFavorites ? 1 : 0)})`
            : "Show results"
        }
      >
        <div className="space-y-4">
          <FilterSection title="Category">
            {catLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                <FilterSelectRow
                  label="All categories"
                  selected={draftCategory === undefined}
                  onClick={() => setDraftCategory(undefined)}
                />
                {modeCategoryNames.map((name) => (
                  <FilterSelectRow
                    key={name}
                    label={name}
                    selected={draftCategory === name}
                    onClick={() => setDraftCategory(name)}
                    showDivider
                  />
                ))}
              </>
            )}
          </FilterSection>

          <FilterSection title="Availability">
            <FilterTileGrid
              options={availabilityPills}
              value={draftAvailability}
              onChange={(id) => setDraftAvailability(id as AvailabilityFilter)}
            />
          </FilterSection>

          <FilterSection title="Saved">
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="browse-favorites" className="text-sm font-semibold">
                  Favorites only
                </Label>
                <p className="text-xs text-muted-foreground">Show items you have saved</p>
              </div>
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
        </div>
      </FilterPanel>

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
                {item.listingStatus !== "product_only" && (
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
                )}
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
                  {(() => {
                    const isChem = !!item.isChemical;
                    const showRent = !isChem && (item.isRentEnabled ?? true);
                    const showBuy = isChem || !!item.isBuyEnabled;
                    return (
                      <>
                        {showRent && (
                          <>
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
                          </>
                        )}
                        {showBuy && (
                          <Badge variant="secondary" className="font-normal tabular-nums bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {(() => {
                              const min = item.buyPrice;
                              const max = item.maxBuyPrice;
                              if (min == null || min <= 0) {
                                return "Buy Price: See details";
                              }
                              const amount =
                                max != null && max > min
                                  ? `₹${min.toFixed(0)} – ₹${max.toFixed(0)}`
                                  : `₹${min.toFixed(0)}`;
                              return isChem
                                ? `Buy from ${amount}`
                                : `Buy Price: ${amount}${item.baseUnit ? ` / ${item.baseUnit}` : ""}`;
                            })()}
                          </Badge>
                        )}
                      </>
                    );
                  })()}
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
