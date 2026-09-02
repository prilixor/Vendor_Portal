import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { StatCard } from "@/app/components/shared/StatCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { InventoryMovement, InventoryRecord } from "@/app/models";
import { Boxes, CheckCircle2, Clock, Package, Lock, ArrowDownRight, ArrowUpRight, Pause, Play, Ban, Pencil, Plus, Minus, Loader2, Barcode, Trash2, Search, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { ListingThumb } from "@/app/components/shared/ListingThumb";
import { useAuth } from "@/app/guards/AuthContext";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";
import { vendorOnboardingApi, type VendorProductAssetApiDto, type TrackedAssetDto, type VendorVariantInventoryDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";
import { cn, resolveItemImageUrl } from "@/app/helpers/utils";

type ChemicalStockEditRow = {
  productVariantId: string;
  sku: string;
  sizeLabel: string;
  total: number;
  reserved: number;
  available: number;
};

const movementMeta: Record<string, { label: string; icon: any; cls: string }> = {
  stock_added: { label: "Stock Added", icon: ArrowDownRight, cls: "bg-success-soft text-success" },
  stock_removed: { label: "Stock Removed", icon: ArrowUpRight, cls: "bg-info-soft text-info" },
  reserved: { label: "Reserved", icon: Pause, cls: "bg-warning-soft text-warning" },
  reservation_released: { label: "Reservation Released", icon: Play, cls: "bg-primary-soft text-primary" },
  rented: { label: "Rented", icon: ArrowUpRight, cls: "bg-info-soft text-info" },
  returned: { label: "Returned", icon: ArrowDownRight, cls: "bg-success-soft text-success" },
  blocked: { label: "Blocked", icon: Ban, cls: "bg-destructive-soft text-destructive" },
  unblocked: { label: "Unblocked", icon: Play, cls: "bg-primary-soft text-primary" },
  corrected: { label: "Corrected", icon: Clock, cls: "bg-muted-soft text-muted-foreground" },
  in: { label: "Stock In", icon: ArrowDownRight, cls: "bg-success-soft text-success" },
  out: { label: "Stock Out", icon: ArrowUpRight, cls: "bg-info-soft text-info" },
  released: { label: "Released", icon: Play, cls: "bg-primary-soft text-primary" },
};

const assetStatusClass = (status: string) => {
  switch (status.trim().toLowerCase()) {
    case "available":
      return "bg-success-soft text-success";
    case "rented":
      return "bg-info-soft text-info";
    case "reserved":
      return "bg-warning-soft text-warning";
    case "sold":
    case "bought":
    case "bought_out":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted-soft text-muted-foreground";
  }
};

type StockMetric = "total" | "available" | "reserved" | "rented" | "blocked";

const StockSplitHover = ({
  label,
  equipment,
  chemical,
  combined,
  children,
}: {
  label: string;
  equipment: number;
  chemical: number;
  combined: number;
  children: React.ReactNode;
}) => (
  <HoverCard openDelay={120} closeDelay={80}>
    <HoverCardTrigger asChild>
      <div className="cursor-default outline-none">{children}</div>
    </HoverCardTrigger>
    <HoverCardContent className="w-56 p-3" side="bottom" align="center">
      <p className="text-sm font-semibold">{label} stock</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Equipment vs chemicals</p>
      <div className="mt-2.5 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Equipment
          </span>
          <span className="font-mono font-bold tabular-nums">{equipment}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" />
            Chemicals
          </span>
          <span className="font-mono font-bold tabular-nums">{chemical}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 font-semibold">
          <span>All stock</span>
          <span className="font-mono tabular-nums">{combined}</span>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);

const Inventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [editingRow, setEditingRow] = useState<InventoryRecord | null>(null);
  const [editForm, setEditForm] = useState({ total: 0, reserved: 0, rented: 0, blocked: 0 });
  const [chemicalEditRows, setChemicalEditRows] = useState<ChemicalStockEditRow[]>([]);
  const [chemicalEditLoading, setChemicalEditLoading] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementRow, setMovementRow] = useState<InventoryRecord | null>(null);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementQtyInput, setMovementQtyInput] = useState("1");
  const [activeTab, setActiveTab] = useState<"equipment" | "chemical">("equipment");
  const [listingIsChemical, setListingIsChemical] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { operationsBlocked } = useVendorVerification();
  const isPending = operationsBlocked;

  const [assetRow, setAssetRow] = useState<InventoryRecord | null>(null);
  const [assets, setAssets] = useState<VendorProductAssetApiDto[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [newAssetTag, setNewAssetTag] = useState("");
  const [newAssetCondition, setNewAssetCondition] = useState("");
  const [newAssetVariantId, setNewAssetVariantId] = useState("");
  const [assetVariantOptions, setAssetVariantOptions] = useState<VendorVariantInventoryDto[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [trackAssetDialogOpen, setTrackAssetDialogOpen] = useState(false);
  const [trackAssetTag, setTrackAssetTag] = useState("");
  const [trackedAssetResult, setTrackedAssetResult] = useState<TrackedAssetDto | null>(null);
  const [trackAssetLoading, setTrackAssetLoading] = useState(false);
  const [trackAssetError, setTrackAssetError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const itemsPerPage = 5;
  const movementsPerPage = 8;

  const filteredInventory = useMemo(() => {
    let result = inventory;
    result = result.filter(row => {
      const isChem = listingIsChemical[row.productId] || false;
      if (activeTab === "equipment" && isChem) return false;
      if (activeTab === "chemical" && !isChem) return false;
      return true;
    });

    if (searchQuery.trim()) {
      result = result.filter(row => 
        row.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [inventory, searchQuery, activeTab, listingIsChemical]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  const totalInventoryPages = Math.max(1, Math.ceil(filteredInventory.length / itemsPerPage));
  const safeInventoryPage = Math.min(currentPage, totalInventoryPages);
  const paginatedInventory = useMemo(
    () =>
      filteredInventory.slice(
        (safeInventoryPage - 1) * itemsPerPage,
        safeInventoryPage * itemsPerPage,
      ),
    [filteredInventory, safeInventoryPage],
  );

  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementsPerPage));
  const safeMovementPage = Math.min(movementPage, totalMovementPages);
  const paginatedMovements = useMemo(
    () =>
      movements.slice(
        (safeMovementPage - 1) * movementsPerPage,
        safeMovementPage * movementsPerPage,
      ),
    [movements, safeMovementPage],
  );


  const loadInventory = async () => {
    if (!user) return;

    const [listings, products] = await Promise.all([
      vendorOnboardingApi.getVendorProductListings(user.id),
      vendorOnboardingApi.getProducts(),
    ]);

    const productById = new Map(products.map((p) => [p.id, p.productName]));
    
    const isChemMap: Record<string, boolean> = {};
    listings.forEach(l => {
      const p = products.find(prod => prod.id === l.productId);
      isChemMap[l.id] = !!(
        l.isChemical ||
        p?.baseUnit ||
        p?.casNumber ||
        p?.chemicalFormula
      );
    });
    setListingIsChemical(isChemMap);

    const rows = await Promise.all(
      listings.map(async (listing) => {
        const isChemical = !!isChemMap[listing.id];
        const baseName = `${listing.listingTitle}${productById.get(listing.productId) ? ` (${productById.get(listing.productId)})` : ""}`;
        const primaryImage =
          resolveItemImageUrl({
            primaryImageUrl: listing.primaryImageUrl,
            primaryThumbnailUrl: listing.primaryThumbnailUrl,
          }) ?? undefined;

        try {
          // Chemicals: packaging-size (variant) stock is the source of truth — not flat VendorInventory.
          if (isChemical) {
            const [inv, variantRows] = await Promise.all([
              vendorOnboardingApi.getVendorInventory(user.id, listing.id).catch(() => null),
              vendorOnboardingApi.getVariantInventory(user.id, listing.id).catch(() => []),
            ]);

            if (variantRows.length > 0) {
              const total = variantRows.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
              const available = variantRows.reduce((sum, r) => sum + (r.availableQuantity || 0), 0);
              const reserved = variantRows.reduce((sum, r) => sum + (r.reservedQuantity || 0), 0);
              return {
                productId: listing.id,
                catalogProductId: listing.productId,
                isChemical: true,
                productName: baseName,
                primaryImage,
                total,
                available,
                reserved,
                rented: 0,
                blocked: inv?.blockedQuantity ?? 0,
              } satisfies InventoryRecord;
            }
          }

          const inv = await vendorOnboardingApi.getVendorInventory(user.id, listing.id);
          return {
            productId: listing.id,
            catalogProductId: listing.productId,
            isChemical,
            productName: baseName,
            primaryImage,
            total: inv.totalQuantity,
            available: inv.availableQuantity,
            reserved: inv.reservedQuantity,
            rented: inv.rentedQuantity,
            blocked: inv.blockedQuantity,
          } satisfies InventoryRecord;
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          if (!message.includes("not found")) {
            throw error;
          }
          const seeded = await vendorOnboardingApi.upsertVendorInventory(user.id, listing.id, {
            vendorId: user.id,
            listingId: listing.id,
            totalQuantity: listing.availableQuantity,
            availableQuantity: listing.availableQuantity,
            reservedQuantity: 0,
            rentedQuantity: 0,
            blockedQuantity: 0,
          });
          return {
            productId: listing.id,
            catalogProductId: listing.productId,
            isChemical,
            productName: baseName,
            primaryImage,
            total: seeded.totalQuantity,
            available: seeded.availableQuantity,
            reserved: seeded.reservedQuantity,
            rented: seeded.rentedQuantity,
            blocked: seeded.blockedQuantity,
          } satisfies InventoryRecord;
        }
      })
    );

    setInventory(rows);

    const movementRows = await Promise.all(
      listings.map(async (listing) => {
        try {
          const m = await vendorOnboardingApi.getVendorInventoryMovements(user.id, listing.id);
          return m.map((x) => ({
            id: x.id,
            productName: `${listing.listingTitle}${productById.get(listing.productId) ? ` (${productById.get(listing.productId)})` : ""}`,
            type: toUiMovementType(x.movementType),
            quantity: x.quantity,
            reference: x.referenceType || x.referenceId || "-",
            timestamp: x.eventAt || new Date().toISOString(),
          } satisfies InventoryMovement));
        } catch {
          return [] as InventoryMovement[];
        }
      })
    );

    const sortedMovements = movementRows.flat().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setMovements(sortedMovements);
  };

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        await loadInventory();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load inventory.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };
    void run();
  }, [user]);

  const totals = useMemo(
    () =>
      inventory.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          available: acc.available + r.available,
          reserved: acc.reserved + r.reserved,
          rented: acc.rented + r.rented,
          blocked: acc.blocked + r.blocked,
        }),
        { total: 0, available: 0, reserved: 0, rented: 0, blocked: 0 }
      ),
    [inventory]
  );

  const splitTotals = useMemo(() => {
    const empty = () => ({ total: 0, available: 0, reserved: 0, rented: 0, blocked: 0 });
    const equipment = empty();
    const chemical = empty();
    for (const row of inventory) {
      const bucket = listingIsChemical[row.productId] || row.isChemical ? chemical : equipment;
      bucket.total += row.total;
      bucket.available += row.available;
      bucket.reserved += row.reserved;
      bucket.rented += row.rented;
      bucket.blocked += row.blocked;
    }
    return { equipment, chemical };
  }, [inventory, listingIsChemical]);

  const tabCounts = useMemo(
    () => ({
      equipment: inventory.filter((r) => !listingIsChemical[r.productId]).length,
      chemical: inventory.filter((r) => !!listingIsChemical[r.productId]).length,
    }),
    [inventory, listingIsChemical],
  );

  const summaryStats: { key: StockMetric; label: string; value: number; cls: string }[] = [
    { key: "total", label: "Total", value: totals.total, cls: "text-foreground" },
    { key: "available", label: "Available", value: totals.available, cls: "text-success" },
    { key: "reserved", label: "Reserved", value: totals.reserved, cls: "text-warning" },
    { key: "rented", label: "Rented", value: totals.rented, cls: "text-info" },
    { key: "blocked", label: "Blocked", value: totals.blocked, cls: "text-destructive" },
  ];

  const filteredAssets = useMemo(
    () => assets.filter((a) => a.assetTag.toLowerCase().includes(assetSearchQuery.trim().toLowerCase())),
    [assets, assetSearchQuery],
  );

  const openEdit = async (row: InventoryRecord) => {
    setFieldErrors({});
    setEditingRow(row);
    setEditForm({
      total: row.total,
      reserved: row.reserved,
      rented: row.rented,
      blocked: row.blocked,
    });
    setChemicalEditRows([]);

    if (!(row.isChemical || listingIsChemical[row.productId]) || !user) return;

    try {
      setChemicalEditLoading(true);
      const rows = await vendorOnboardingApi.getVariantInventory(user.id, row.productId);
      setChemicalEditRows(
        rows.map((r) => ({
          productVariantId: r.productVariantId,
          sku: r.sku,
          sizeLabel: `${r.sizeValue} ${r.sizeUnit}`,
          total: r.totalQuantity,
          reserved: r.reservedQuantity,
          available: r.availableQuantity,
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load packaging stock.";
      toast.error(message);
    } finally {
      setChemicalEditLoading(false);
    }
  };

  const updateFormValue = (field: "total" | "reserved" | "rented" | "blocked", value: string) => {
    const parsed = Number(value);
    setEditForm((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0,
    }));
  };

  const updateChemicalStockValue = (productVariantId: string, value: string) => {
    const parsed = Number(value);
    const nextTotal = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    setChemicalEditRows((prev) =>
      prev.map((row) => {
        if (row.productVariantId !== productVariantId) return row;
        const reserved = Math.min(row.reserved, nextTotal);
        return {
          ...row,
          total: nextTotal,
          reserved,
          available: Math.max(0, nextTotal - reserved),
        };
      })
    );
  };

  const computedAvailable = Math.max(0, editForm.total - editForm.reserved - editForm.rented - editForm.blocked);
  const isEditingChemical = !!(editingRow && (editingRow.isChemical || listingIsChemical[editingRow.productId]));
  const chemicalEditTotal = chemicalEditRows.reduce((sum, row) => sum + row.total, 0);

  const saveEdit = async () => {
    if (!editingRow || !user) return;

    // Chemicals: stock is managed per packaging size (measurement), then rolled up to listing totals.
    if (editingRow.isChemical || listingIsChemical[editingRow.productId]) {
      if (chemicalEditRows.length === 0) {
        toast.error("No packaging sizes found. Ask Admin to add sizes (e.g. 1L, 5L) for this chemical.");
        return;
      }

      for (const row of chemicalEditRows) {
        if (row.reserved > row.total) {
          toast.error(`Reserved cannot exceed total for ${row.sizeLabel}.`);
          return;
        }
      }

      try {
        setBusy(true);
        const previousTotal = editingRow.total;
        await vendorOnboardingApi.upsertVariantInventory(
          user.id,
          editingRow.productId,
          chemicalEditRows.map((row) => ({
            productVariantId: row.productVariantId,
            totalQuantity: row.total,
          }))
        );

        const nextTotal = chemicalEditRows.reduce((sum, row) => sum + row.total, 0);
        const totalDiff = nextTotal - previousTotal;
        if (totalDiff !== 0) {
          await vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
            vendorId: user.id,
            listingId: editingRow.productId,
            movementType: totalDiff > 0 ? "stock_added" : "stock_removed",
            quantity: Math.abs(totalDiff),
            referenceType: "manual_correction",
            notes: "Chemical packaging stock updated via Inventory",
          });
        }

        try {
          await loadInventory();
          setEditingRow(null);
          setChemicalEditRows([]);
          toast.success("Chemical stock updated by packaging size.");
        } catch (err) {
          console.error("Failed to reload inventory after chemical edit:", err);
          toast.error("Changes saved but failed to refresh inventory. Please reload the page.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update chemical inventory.";
        toast.error(message);
      } finally {
        setBusy(false);
      }
      return;
    }
    
    // Validation
    if (editForm.reserved > editForm.total) {
      toast.error("Reserved items cannot be more than total stock.");
      return;
    }
    
    if (editForm.rented > editForm.total - editForm.reserved) {
      toast.error("Not enough stock available for rented items.");
      return;
    }
    
    if (editForm.blocked > editForm.total - editForm.reserved - editForm.rented) {
      toast.error("Not enough stock available for blocked items.");
      return;
    }
    
    const cappedReserved = Math.min(editForm.reserved, editForm.total);
    const cappedRented = Math.min(editForm.rented, Math.max(0, editForm.total - cappedReserved));
    const cappedBlocked = Math.min(editForm.blocked, Math.max(0, editForm.total - cappedReserved - cappedRented));
    const nextAvailable = Math.max(0, editForm.total - cappedReserved - cappedRented - cappedBlocked);

    try {
      setBusy(true);
      await vendorOnboardingApi.upsertVendorInventory(user.id, editingRow.productId, {
        vendorId: user.id,
        listingId: editingRow.productId,
        totalQuantity: editForm.total,
        availableQuantity: nextAvailable,
        reservedQuantity: cappedReserved,
        rentedQuantity: cappedRented,
        blockedQuantity: cappedBlocked,
      });

      // Create movement records for changes
      const movements = [];
      
      // Total quantity change
      const totalDiff = editForm.total - editingRow.total;
      if (totalDiff > 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "stock_added",
          quantity: totalDiff,
          referenceType: "manual_correction",
          notes: "Total quantity increased via edit",
        }));
      } else if (totalDiff < 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "stock_removed",
          quantity: Math.abs(totalDiff),
          referenceType: "manual_correction",
          notes: "Total quantity decreased via edit",
        }));
      }

      // Reserved quantity change
      const reservedDiff = cappedReserved - editingRow.reserved;
      if (reservedDiff > 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "reserved",
          quantity: reservedDiff,
          referenceType: "manual_correction",
          notes: "Reserved quantity increased via edit",
        }));
      } else if (reservedDiff < 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "reservation_released",
          quantity: Math.abs(reservedDiff),
          referenceType: "manual_correction",
          notes: "Reserved quantity decreased via edit",
        }));
      }

      // Rented quantity change
      const rentedDiff = cappedRented - editingRow.rented;
      if (rentedDiff > 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "rented",
          quantity: rentedDiff,
          referenceType: "manual_correction",
          notes: "Rented quantity increased via edit",
        }));
      } else if (rentedDiff < 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "returned",
          quantity: Math.abs(rentedDiff),
          referenceType: "manual_correction",
          notes: "Rented quantity decreased via edit",
        }));
      }

      // Blocked quantity change
      const blockedDiff = cappedBlocked - editingRow.blocked;
      if (blockedDiff > 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "blocked",
          quantity: blockedDiff,
          referenceType: "manual_correction",
          notes: "Blocked quantity increased via edit",
        }));
      } else if (blockedDiff < 0) {
        movements.push(vendorOnboardingApi.addVendorInventoryMovement(user.id, editingRow.productId, {
          vendorId: user.id,
          listingId: editingRow.productId,
          movementType: "unblocked",
          quantity: Math.abs(blockedDiff),
          referenceType: "manual_correction",
          notes: "Blocked quantity decreased via edit",
        }));
      }

      // Execute all movement additions
      await Promise.all(movements);

      // Reload inventory while dialog stays open (showing loading state)
      try {
        await loadInventory();
        setEditingRow(null);
        toast.success("Inventory updated.");
      } catch (err) {
        console.error("Failed to reload inventory after edit:", err);
        toast.error("Changes saved but failed to refresh inventory. Please reload the page.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update inventory.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openMovement = (row: InventoryRecord, type: "in" | "out") => {
    setFieldErrors({});
    setMovementRow(row);
    setMovementType(type);
    setMovementQtyInput("1");
  };

  const saveMovement = async () => {
    if (!movementRow || !user) return;
    const parsedQty = Number(movementQtyInput);
    if (!movementQtyInput.trim() || !Number.isFinite(parsedQty) || parsedQty < 1) {
      setFieldErrors({ quantity: "Please enter a quantity of at least 1." });
      toast.error("Please fill in the required fields.");
      return;
    }
    setFieldErrors({});
    const qty = Math.max(1, Math.floor(parsedQty));

    const current = movementRow;
    const removable = Math.min(qty, current.available);
    const nextTotal = movementType === "in" ? current.total + qty : Math.max(0, current.total - removable);
    const nextAvailable = movementType === "in" ? current.available + qty : Math.max(0, current.available - removable);

    try {
      setBusy(true);
      await vendorOnboardingApi.upsertVendorInventory(user.id, current.productId, {
        vendorId: user.id,
        listingId: current.productId,
        totalQuantity: nextTotal,
        availableQuantity: nextAvailable,
        reservedQuantity: current.reserved,
        rentedQuantity: current.rented,
        blockedQuantity: current.blocked,
      });

      await vendorOnboardingApi.addVendorInventoryMovement(user.id, current.productId, {
        vendorId: user.id,
        listingId: current.productId,
        movementType: movementType === "in" ? "stock_added" : "stock_removed",
        quantity: movementType === "in" ? qty : removable,
        referenceType: "manual_adjustment",
        notes: movementType === "in" ? "Manual stock add from vendor UI" : "Manual stock remove from vendor UI",
      });

      // Reload inventory while dialog stays open (showing loading state)
      try {
        await loadInventory();
        setMovementRow(null);
        toast.success(movementType === "in" ? "Stock added." : "Stock removed.");
      } catch (err) {
        console.error("Failed to reload inventory after movement:", err);
        toast.error("Changes saved but failed to refresh inventory. Please reload the page.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save movement.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openAssets = async (row: InventoryRecord) => {
    setFieldErrors({});
    setAssetRow(row);
    setAssetsLoading(true);
    setNewAssetTag("");
    setNewAssetCondition("");
    setNewAssetVariantId("");
    setAssetVariantOptions([]);
    setAssetSearchQuery("");
    try {
      if (!user) return;
      const isChem = row.isChemical || listingIsChemical[row.productId];
      const [data, variantStock] = await Promise.all([
        vendorOnboardingApi.getVendorProductAssets(user.id, row.productId),
        isChem
          ? vendorOnboardingApi.getVariantInventory(user.id, row.productId).catch(() => [] as VendorVariantInventoryDto[])
          : Promise.resolve([] as VendorVariantInventoryDto[]),
      ]);
      setAssets(data);
      setAssetVariantOptions(variantStock);
      if (variantStock.length === 1) {
        setNewAssetVariantId(variantStock[0].productVariantId);
      }
    } catch (err) {
      toast.error("Failed to load serial numbers");
    } finally {
      setAssetsLoading(false);
    }
  };

  const selectedAssetVariantStock = assetVariantOptions.find((v) => v.productVariantId === newAssetVariantId);
  const selectedAssetVariantSerialCount = newAssetVariantId
    ? assets.filter((a) => a.productVariantId === newAssetVariantId).length
    : 0;
  const selectedAssetVariantRemaining = selectedAssetVariantStock
    ? Math.max(0, selectedAssetVariantStock.totalQuantity - selectedAssetVariantSerialCount)
    : 0;
  const isAssetRowChemical = !!(assetRow && (assetRow.isChemical || listingIsChemical[assetRow.productId]));

  const handleAddAsset = async () => {
    if (!assetRow || !user) return;
    const isChem = assetRow.isChemical || listingIsChemical[assetRow.productId];

    const errors: Record<string, string> = {};
    if (!newAssetTag.trim()) {
      errors.assetTag = isChem ? "Please enter a batch/serial number." : "Please enter a serial number.";
    }
    if (isChem && !newAssetVariantId) {
      errors.assetVariantId = "Please select a packaging size.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    if (isChem && selectedAssetVariantRemaining <= 0) {
      toast.error("No remaining stock slots for this packaging size. Increase stock first.");
      return;
    }
    try {
      setAssetsLoading(true);
      setFieldErrors({});
      await vendorOnboardingApi.addVendorProductAsset(user.id, assetRow.productId, {
        vendorId: user.id,
        listingId: assetRow.productId,
        assetTag: newAssetTag.trim(),
        status: "Available",
        condition: newAssetCondition.trim() || undefined,
        productVariantId: isChem ? newAssetVariantId : undefined,
      });
      toast.success(isChem ? "Batch/serial number added" : "Serial number added");
      setNewAssetTag("");
      setNewAssetCondition("");
      const data = await vendorOnboardingApi.getVendorProductAssets(user.id, assetRow.productId);
      setAssets(data);
    } catch (err: any) {
      const message = err?.message || "Failed to add serial number";
      toast.error(message);
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!assetRow || !user) return;
    try {
      setAssetsLoading(true);
      await vendorOnboardingApi.deleteVendorProductAsset(user.id, assetRow.productId, assetId);
      toast.success("Serial number removed");
      const data = await vendorOnboardingApi.getVendorProductAssets(user.id, assetRow.productId);
      setAssets(data);
    } catch (err) {
      toast.error("Failed to remove serial number");
    } finally {
      setAssetsLoading(false);
    }
  };

  const handleTrackAsset = async () => {
    if (!user || !trackAssetTag.trim()) return;
    try {
      setTrackAssetLoading(true);
      setTrackAssetError(null);
      setTrackedAssetResult(null);
      const result = await vendorOnboardingApi.trackVendorProductAsset(user.id, trackAssetTag.trim());
      setTrackedAssetResult(result);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setTrackAssetError("Serial number not found.");
      } else {
        setTrackAssetError("Failed to track serial number.");
      }
    } finally {
      setTrackAssetLoading(false);
    }
  };

  const stockRowActions = (row: InventoryRecord) => (
    <TooltipProvider>
      <div className="flex w-full justify-between gap-1 sm:w-auto sm:justify-end">
        {activeTab === "equipment" && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="ghost" size="icon" onClick={() => openMovement(row, "in")} aria-label={`Add stock for ${row.productName}`} disabled={busy || isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {isPending && (
                <TooltipContent side="top">
                  <p>Available once your account is approved</p>
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button variant="ghost" size="icon" onClick={() => openMovement(row, "out")} aria-label={`Remove stock for ${row.productName}`} disabled={busy || isPending}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {isPending && (
                <TooltipContent side="top">
                  <p>Available once your account is approved</p>
                </TooltipContent>
              )}
            </Tooltip>
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button variant="ghost" size="icon" onClick={() => openAssets(row)} aria-label={`Manage serial numbers for ${row.productName}`} disabled={busy || isPending}>
                <Barcode className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{isPending ? "Available once your account is approved" : activeTab === "chemical" ? "Batch / serial by packaging size" : "Serial numbers"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button variant="ghost" size="icon" onClick={() => void openEdit(row)} aria-label={`Edit ${row.productName} stock`} disabled={busy || isPending}>
                <Pencil className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{isPending ? "Available once your account is approved" : activeTab === "chemical" ? "Edit stock by packaging size" : "Edit stock"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader 
        title="Inventory" 
        description="Track stock levels and movements across all your products."
        actions={
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
            setTrackAssetDialogOpen(true);
            setTrackAssetTag("");
            setTrackedAssetResult(null);
            setTrackAssetError(null);
          }}>
            <Search className="mr-2 h-4 w-4" />
            <span className="sm:hidden">Track serial</span>
            <span className="hidden sm:inline">Track Serial Number</span>
          </Button>
        }
      />

      {!hasLoaded && busy && <PageLoaderSlot />}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      {hasLoaded && (
        <>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card sm:hidden">
            <div className="grid grid-cols-5 divide-x divide-border">
              {summaryStats.map((stat) => (
                <StockSplitHover
                  key={stat.key}
                  label={stat.label}
                  equipment={splitTotals.equipment[stat.key]}
                  chemical={splitTotals.chemical[stat.key]}
                  combined={stat.value}
                >
                  <div
                    className="px-1 py-3 text-center"
                    aria-label={`${stat.label}: ${stat.value}. Equipment ${splitTotals.equipment[stat.key]}, chemicals ${splitTotals.chemical[stat.key]}.`}
                  >
                    <p className="text-[10px] font-medium leading-tight tracking-wide text-muted-foreground">{stat.label}</p>
                    <p className={cn("mt-1 font-mono text-base font-bold tabular-nums", stat.cls)}>{stat.value}</p>
                  </div>
                </StockSplitHover>
              ))}
            </div>
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-5">
            {summaryStats.map((stat) => {
              const icon = { total: Boxes, available: CheckCircle2, reserved: Clock, rented: Package, blocked: Lock }[stat.key];
              const accent = { total: "primary", available: "success", reserved: "warning", rented: "info", blocked: "primary" }[stat.key] as "primary" | "success" | "warning" | "info";
              return (
                <StockSplitHover
                  key={stat.key}
                  label={stat.label}
                  equipment={splitTotals.equipment[stat.key]}
                  chemical={splitTotals.chemical[stat.key]}
                  combined={stat.value}
                >
                  <StatCard label={stat.label} value={stat.value} icon={icon} accent={accent} />
                </StockSplitHover>
              );
            })}
          </div>

      <Card className="mt-4 min-w-0 overflow-hidden border-border/60 p-4 [overflow-anchor:none] sm:mt-6 sm:p-6 lg:p-8">
        <div className="space-y-3 border-b border-border pb-4">
          <h2 className="font-semibold">Stock by product</h2>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "equipment" | "chemical")}>
            <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
              <TabsTrigger value="equipment" className="min-w-0 gap-1.5 px-2 py-2 text-xs sm:px-3 sm:text-sm">
                <Package className="h-4 w-4 shrink-0" />
                <span className="truncate">Equipment</span>
                <span className="text-muted-foreground">({tabCounts.equipment})</span>
              </TabsTrigger>
              <TabsTrigger value="chemical" className="min-w-0 gap-1.5 px-2 py-2 text-xs sm:px-3 sm:text-sm">
                <FlaskConical className="h-4 w-4 shrink-0" />
                <span className="truncate">Chemicals</span>
                <span className="text-muted-foreground">({tabCounts.chemical})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="mt-4 space-y-3 md:hidden" style={filteredInventory.length > 0 ? { minHeight: itemsPerPage * 168 } : undefined}>
          {paginatedInventory.map((row) => {
            const utilization = row.total === 0 ? 0 : ((row.rented + row.reserved) / row.total) * 100;
            const stockCells = [
              { label: "Total", title: "Total units", value: row.total, cls: "text-foreground" },
              { label: "Available", title: "Available units ready to fulfill", value: row.available, cls: "text-success" },
              ...(activeTab === "equipment" ? [{ label: "Rented", title: "Rented units currently out", value: row.rented, cls: "text-info" }] : []),
              { label: "Reserved", title: "Reserved — held for pending orders", value: row.reserved, cls: "text-warning" },
              { label: "Blocked", title: "Blocked units that cannot be sold or rented", value: row.blocked, cls: "text-destructive" },
            ];
            return (
              <div key={row.productId} className="min-w-0 rounded-xl border border-border bg-card p-3">
                <div className="flex min-w-0 items-start gap-3">
                  <ListingThumb src={row.primaryImage} alt={row.productName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{row.productName}</p>
                    <div
                      className="mt-2 flex items-center gap-2"
                      title={`Utilization ${utilization.toFixed(0)}% — reserved and rented as a share of total`}
                      aria-label={`Utilization ${utilization.toFixed(0)} percent`}
                    >
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-gradient-primary" style={{ width: `${utilization}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums">{utilization.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
                <div className={cn("mt-3 grid overflow-hidden rounded-lg border border-border bg-border", activeTab === "equipment" ? "grid-cols-5" : "grid-cols-4")}>
                  {stockCells.map((cell) => (
                    <div key={cell.label} className="bg-card px-1 py-2 text-center" title={cell.title}>
                      <p className="text-[10px] font-medium leading-tight tracking-wide text-muted-foreground">{cell.label}</p>
                      <p className={cn("font-mono text-sm font-semibold tabular-nums", cell.cls)}>{cell.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-border/60 pt-1">{stockRowActions(row)}</div>
              </div>
            );
          })}
          {hasLoaded && inventory.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No listings found to track inventory yet.</p>
          )}
          {hasLoaded && inventory.length > 0 && filteredInventory.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No products match your search.</p>
          )}
        </div>

        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-border md:block">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Available</th>
                {activeTab === "equipment" && <th className="px-4 py-3 font-semibold text-right">Rented</th>}
                <th className="px-4 py-3 font-semibold text-right text-warning">Reserved</th>
                <th className="px-4 py-3 font-semibold text-right text-destructive">Blocked</th>
                <th className="px-4 py-3 font-semibold">Utilization</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedInventory.map((row) => {
                const utilization = row.total === 0 ? 0 : ((row.rented + row.reserved) / row.total) * 100;
                return (
                  <tr key={row.productId} className="h-[72px] hover:bg-muted/20">
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ListingThumb src={row.primaryImage} alt={row.productName} />
                        <span className="min-w-0 truncate font-medium">{row.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono">{row.total}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="inline-flex items-center justify-center font-mono font-medium text-success bg-success/10 px-2.5 py-0.5 rounded-full min-w-[3rem]">
                        {row.available}
                      </span>
                    </td>
                    {activeTab === "equipment" && (
                      <td className="px-4 py-4 text-right font-mono text-info">{row.rented}</td>
                    )}
                    <td className="px-4 py-4 text-right font-mono text-warning">{row.reserved}</td>
                    <td className="px-4 py-4 text-right font-mono text-destructive">{row.blocked}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-gradient-primary" style={{ width: `${utilization}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {stockRowActions(row)}
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length > 0 &&
                Array.from({ length: Math.max(0, itemsPerPage - paginatedInventory.length) }).map((_, i) => (
                  <tr key={`stock-pad-${i}`} className="h-[72px]">
                    <td colSpan={activeTab === "equipment" ? 8 : 7} />
                  </tr>
                ))}
              {hasLoaded && inventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No listings found to track inventory yet.
                  </td>
                </tr>
              )}
              {hasLoaded && inventory.length > 0 && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No products match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredInventory.length > 0 && (
          <TablePagination
            page={safeInventoryPage}
            pageSize={itemsPerPage}
            total={filteredInventory.length}
            onPageChange={setCurrentPage}
            label="products"
            ariaLabel="Product stock pagination"
          />
        )}
      </Card>
      <Card className="mt-8 min-w-0 overflow-hidden border-border/60 [overflow-anchor:none]">
        <div className="border-b border-border px-4 py-3 sm:p-4">
          <h2 className="font-semibold">Movement history</h2>
        </div>
        <ul
          className="divide-y divide-border"
          style={movements.length > 0 ? { minHeight: movementsPerPage * 72 } : undefined}
        >
          {paginatedMovements.map((m) => {
            const meta = movementMeta[m.type];
            const Icon = meta.icon;
            const isPositive = ["stock_added", "returned", "in", "released", "unblocked", "corrected"].includes(m.type);
            return (
              <li key={m.id} className="flex min-w-0 items-start gap-3 p-3 sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${meta.cls}`}>
                    <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{meta.label} · {m.productName}</p>
                    <p className="truncate text-xs text-muted-foreground">Ref: {m.reference}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-semibold">{isPositive ? "+" : "-"}{m.quantity}</p>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(m.timestamp), "MMM d, HH:mm")}</p>
                </div>
              </li>
            );
          })}
          {hasLoaded && !busy && movements.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No movement history yet.</li>
          )}
        </ul>
        {movements.length > 0 && (
          <div className="px-4 pb-4">
            <TablePagination
              page={safeMovementPage}
              pageSize={movementsPerPage}
              total={movements.length}
              onPageChange={setMovementPage}
              label="movements"
              ariaLabel="Movement history pagination"
            />
          </div>
        )}
      </Card>

      <Dialog open={!!editingRow} onOpenChange={(open) => !open && (setEditingRow(null), setChemicalEditRows([]))}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto ${isEditingChemical ? "max-w-2xl sm:max-w-2xl" : "max-w-md sm:max-w-md"}`}>
          <DialogHeader>
            <DialogTitle>
              {isEditingChemical ? "Edit packaging stock" : "Edit stock"} - {editingRow?.productName}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1 space-y-4">
            {isEditingChemical ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Chemicals are stocked by packaging size (e.g. 500 mL, 1 L, 5 L). Update units per size here — not as a single flat total.
                </p>
                {chemicalEditLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : chemicalEditRows.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
                    No packaging sizes defined for this chemical yet. Ask Admin to add variants first.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[28rem] text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Size</th>
                          <th className="px-3 py-2 text-left font-semibold">SKU</th>
                          <th className="px-3 py-2 text-right font-semibold">Total units</th>
                          <th className="px-3 py-2 text-right font-semibold">Reserved</th>
                          <th className="px-3 py-2 text-right font-semibold">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {chemicalEditRows.map((row) => (
                          <tr key={row.productVariantId}>
                            <td className="px-3 py-2 font-medium">{row.sizeLabel}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.sku}</td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={0}
                                className="h-8 w-24 ml-auto text-right"
                                value={row.total}
                                onChange={(e) => updateChemicalStockValue(row.productVariantId, e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-warning">{row.reserved}</td>
                            <td className="px-3 py-2 text-right font-mono text-success">{row.available}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-semibold">
                          <td className="px-3 py-2" colSpan={2}>All sizes</td>
                          <td className="px-3 py-2 text-right font-mono">{chemicalEditTotal}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {chemicalEditRows.reduce((sum, row) => sum + row.reserved, 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {chemicalEditRows.reduce((sum, row) => sum + row.available, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <FormGrid cols={2}>
                  <div className="space-y-1.5">
                    <Label required>Total</Label>
                    <Input type="number" min={0} value={editForm.total} onChange={(e) => updateFormValue("total", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reserved</Label>
                    <Input type="number" min={0} value={editForm.reserved} onChange={(e) => updateFormValue("reserved", e.target.value)} />
                  </div>
                </FormGrid>
                <div className="space-y-2">
                  <Label>Currently Rented</Label>
                  <Input type="number" min="0" value={editForm.rented} onChange={(e) => setEditForm({ ...editForm, rented: parseInt(e.target.value) || 0 })} />
                  <p className="text-[10px] text-muted-foreground leading-tight">Usually managed automatically when orders ship</p>
                </div>
                <div className="space-y-2">
                  <Label>Blocked</Label>
                  <Input type="number" min={0} value={editForm.blocked} onChange={(e) => updateFormValue("blocked", e.target.value)} />
                </div>
                <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  Available (auto): <span className="font-semibold">{computedAvailable}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingRow(null); setChemicalEditRows([]); }} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={busy || (isEditingChemical && (chemicalEditLoading || chemicalEditRows.length === 0))}>
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                "Save stock"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementRow} onOpenChange={(open) => !open && setMovementRow(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{movementType === "in" ? "Stock Added" : "Stock Removed"} - {movementRow?.productName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <div className="space-y-1.5">
            <Label required>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={movementQtyInput}
              onChange={(e) => {
                setMovementQtyInput(e.target.value);
                clearFieldError("quantity");
              }}
              className={fieldErrors.quantity ? "border-destructive" : ""}
            />
            <FieldError message={fieldErrors.quantity} />
            {movementType === "out" && (
              <p className="text-xs text-muted-foreground">Available to remove: {movementRow?.available ?? 0}</p>
            )}
            {movementType === "in" && (
              <div className="h-5" />
            )}
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementRow(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void saveMovement()} disabled={busy}>
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {movementType === "in" ? "Adding..." : "Removing..."}</>
              ) : (
                movementType === "in" ? "Add Stock" : "Remove Stock"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assetRow} onOpenChange={(open) => !open && setAssetRow(null)}>
        <DialogContent className="flex h-[min(92dvh,640px)] max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 sm:px-5">
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Barcode className="h-4 w-4" />
              </span>
              {isAssetRowChemical ? "Batch / serial numbers" : "Serial numbers"}
            </DialogTitle>
            <DialogDescription className="truncate pl-10">
              {assetRow?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={isAssetRowChemical ? "Search batch / serial..." : "Search serial numbers..."}
                className="h-9 pl-9"
                value={assetSearchQuery}
                onChange={(e) => setAssetSearchQuery(e.target.value)}
              />
            </div>
            {isAssetRowChemical && assetVariantOptions.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                One tag per container, tied to packaging size. You cannot exceed that size&apos;s stock.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-3 sm:px-5">
            {assetsLoading && assets.length === 0 ? (
              <div className="flex h-full items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAssets.length > 0 ? (
              <div className="space-y-2">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Barcode className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-semibold tracking-wide">{asset.assetTag}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isAssetRowChemical && asset.variantLabel ? (
                          <span className="mr-1.5 font-medium text-foreground">{asset.variantLabel}</span>
                        ) : null}
                        {asset.condition || "No condition specified"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        assetStatusClass(asset.status),
                      )}
                    >
                      {asset.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => void handleDeleteAsset(asset.id)}
                      aria-label={`Remove ${asset.assetTag}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 text-center text-sm text-muted-foreground">
                {assets.length === 0
                  ? isAssetRowChemical
                    ? "No batch/serial numbers registered yet."
                    : "No serial numbers registered yet."
                  : "No serial numbers match your search."}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
            <p className="mb-2 text-sm font-medium">
              {isAssetRowChemical ? "Register new batch / serial" : "Register new serial"}
            </p>
            <div className="space-y-2">
              {isAssetRowChemical && (
                <div className="space-y-1.5">
                  <Label required className="text-xs">Packaging size</Label>
                  <Select
                    value={newAssetVariantId}
                    onValueChange={(v) => {
                      setNewAssetVariantId(v);
                      clearFieldError("assetVariantId");
                    }}
                  >
                    <SelectTrigger className={cn("h-9", fieldErrors.assetVariantId ? "border-destructive" : "")}>
                      <SelectValue placeholder={assetVariantOptions.length === 0 ? "No packaging sizes / stock yet" : "Select packaging size"} />
                    </SelectTrigger>
                    <SelectContent>
                      {assetVariantOptions.map((v) => {
                        const used = assets.filter((a) => a.productVariantId === v.productVariantId).length;
                        const remaining = Math.max(0, v.totalQuantity - used);
                        return (
                          <SelectItem key={v.productVariantId} value={v.productVariantId} disabled={v.totalQuantity <= 0}>
                            {v.sizeValue} {v.sizeUnit} · stock {v.totalQuantity} · slots left {remaining}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FieldError message={fieldErrors.assetVariantId} />
                  {newAssetVariantId && (
                    <p className="text-[11px] text-muted-foreground">
                      {selectedAssetVariantSerialCount} registered / {selectedAssetVariantStock?.totalQuantity ?? 0} stock
                      {selectedAssetVariantRemaining === 0 ? " — increase stock to add more tags" : ""}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label required className="text-xs">{isAssetRowChemical ? "Batch / serial / tag" : "Serial number / tag"}</Label>
                  <Input
                    placeholder={isAssetRowChemical ? "Batch / serial / tag" : "Serial number / tag"}
                    value={newAssetTag}
                    onChange={(e) => {
                      setNewAssetTag(e.target.value);
                      clearFieldError("assetTag");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddAsset();
                      }
                    }}
                    className={cn("h-9", fieldErrors.assetTag ? "border-destructive" : "")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Condition</Label>
                  <Input
                    placeholder="Optional"
                    value={newAssetCondition}
                    onChange={(e) => setNewAssetCondition(e.target.value)}
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddAsset();
                      }
                    }}
                  />
                </div>
                <Button
                  className="h-9 sm:w-24"
                  onClick={() => void handleAddAsset()}
                  disabled={
                    assetsLoading ||
                    !newAssetTag.trim() ||
                    (isAssetRowChemical && (!newAssetVariantId || selectedAssetVariantRemaining <= 0))
                  }
                >
                  {assetsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
              <FieldError message={fieldErrors.assetTag} />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2.5 sm:px-5">
            <p className="text-xs text-muted-foreground">
              {assets.length} {assets.length === 1 ? "item" : "items"}
              {assetSearchQuery.trim() && filteredAssets.length !== assets.length
                ? ` · ${filteredAssets.length} shown`
                : ""}
            </p>
            <Button variant="outline" size="sm" onClick={() => setAssetRow(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={trackAssetDialogOpen} onOpenChange={setTrackAssetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Track Serial Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Serial Number / Tag"
                value={trackAssetTag}
                onChange={(e) => setTrackAssetTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTrackAsset();
                }}
              />
              <Button onClick={() => void handleTrackAsset()} disabled={trackAssetLoading || !trackAssetTag.trim()}>
                {trackAssetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {trackAssetError && (
              <div className="rounded-md bg-destructive-soft p-3 text-sm text-destructive border border-destructive/30">
                {trackAssetError}
              </div>
            )}
            
            {trackedAssetResult && (
              <div className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Product</p>
                  <p className="font-medium text-foreground">{trackedAssetResult.productName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${trackedAssetResult.status === 'Available' ? 'bg-success-soft text-success' : 'bg-info-soft text-info'}`}>
                      {trackedAssetResult.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Condition</p>
                    <p className="text-sm">{trackedAssetResult.condition || "-"}</p>
                  </div>
                </div>

                {trackedAssetResult.currentOrderId && (
                  <div className="pt-3 border-t border-border mt-3 space-y-3">
                    <p className="text-sm font-semibold">Current Rental Info</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Order #</p>
                        <p className="text-sm font-medium">{trackedAssetResult.currentOrderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Customer</p>
                        <p className="text-sm font-medium">{trackedAssetResult.currentCustomerName}</p>
                      </div>
                      {trackedAssetResult.dueDate && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Due Date</p>
                          <p className="text-sm font-medium">{format(new Date(trackedAssetResult.dueDate), "MMM d, yyyy")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
};

export default Inventory;

const toUiMovementType = (type: string): InventoryMovement["type"] => {
  const value = type.trim().toLowerCase();
  // Return the actual movement type if it's one of the valid types
  const validTypes = ["stock_added", "stock_removed", "reserved", "reservation_released", "rented", "returned", "blocked", "unblocked", "corrected", "in", "out", "released"];
  if (validTypes.includes(value)) {
    return value as InventoryMovement["type"];
  }
  // Fallback to "in" for unknown types
  return "in";
};


