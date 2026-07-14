import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { StatCard } from "@/app/components/shared/StatCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { FieldError } from "@/app/components/shared/FieldError";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { InventoryMovement, InventoryRecord } from "@/app/models";
import { Boxes, CheckCircle2, Clock, Package, Lock, ArrowDownRight, ArrowUpRight, Pause, Play, Ban, Pencil, Plus, Minus, Loader2, Barcode, Trash2, Search, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/app/components/ui/pagination";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi, type VendorProductAssetApiDto, type TrackedAssetDto, type VendorVariantInventoryDto } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";

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
  const [accountStatus, setAccountStatus] = useState<string | null>(null);

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
  const itemsPerPage = 10;

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

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (user) {
      vendorOnboardingApi.getVendorStatus(user.id).then(status => {
        setAccountStatus(status.accountStatus);
      }).catch(() => {
        setAccountStatus(null);
      });
    }
  }, [user]);

  const isPending = accountStatus === "pending";

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

  return (
    <div>
      <PageHeader 
        title="Inventory" 
        description="Track stock levels and movements across all your products."
        actions={
          <Button onClick={() => {
            setTrackAssetDialogOpen(true);
            setTrackAssetTag("");
            setTrackedAssetResult(null);
            setTrackAssetError(null);
          }}>
            <Search className="mr-2 h-4 w-4" />
            Track Serial Number
          </Button>
        }
      />

      {!hasLoaded && busy && (
        <div className="space-y-6 animate-pulse">
          {/* Stats Cards Skeleton - Match exact grid structure */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="border-border/60 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          {/* Inventory Table Skeleton - Match exact structure */}
          <Card className="mt-6 border-border/60 p-4 sm:p-6 lg:p-8">
            <div className="border-b border-border pb-4">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-12" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-16" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-16" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-12" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-12" /></th>
                    <th className="px-4 py-3 font-semibold"><Skeleton className="h-3 w-16" /></th>
                    <th className="px-4 py-3 font-semibold text-right"><Skeleton className="h-3 w-12" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <Skeleton className="h-4 w-8" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <Skeleton className="h-4 w-8" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <Skeleton className="h-4 w-8" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <Skeleton className="h-4 w-8" />
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <Skeleton className="h-4 w-8" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-1.5 flex-1 rounded-full" />
                          <Skeleton className="h-3 w-8" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      {hasLoaded && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total" value={totals.total} icon={Boxes} accent="primary" />
        <StatCard label="Available" value={totals.available} icon={CheckCircle2} accent="success" />
        <StatCard label="Reserved" value={totals.reserved} icon={Clock} accent="warning" />
        <StatCard label="Rented" value={totals.rented} icon={Package} accent="info" />
        <StatCard label="Blocked" value={totals.blocked} icon={Lock} accent="primary" />
      </div>

      <Card className="mt-6 border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold">Stock by product</h2>
            <div className="flex bg-muted p-1 rounded-lg w-fit ml-4">
              <button
                onClick={() => setActiveTab("equipment")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${activeTab === "equipment" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
              >
                <Package className="w-4 h-4 mr-2" />
                Equipment
              </button>
              <button
                onClick={() => setActiveTab("chemical")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center ${activeTab === "chemical" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                Chemicals
              </button>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto rounded-lg border border-border mt-4">
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
                  <tr key={row.productId} className="hover:bg-muted/20">
                    <td className="px-4 py-4 font-medium">{row.productName}</td>
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
                      <TooltipProvider>
                        <div className="flex justify-end gap-1">
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
                    </td>
                  </tr>
                );
              })}
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
        {true && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-4 px-4 pb-4">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredInventory.length)} of {filteredInventory.length} products
            </p>
            <Pagination className="w-auto mx-0">
              <PaginationContent className="flex-wrap justify-center">
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page} className="hidden sm:block">
                    <PaginationLink 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
      <Card className="mt-6 border-border/60">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Movement history</h2>
        </div>
        <ul className="divide-y divide-border">
          {movements.map((m) => {
            const meta = movementMeta[m.type];
            const Icon = meta.icon;
            const isPositive = ["stock_added", "returned", "in", "released", "unblocked", "corrected"].includes(m.type);
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                    <Icon className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{meta.label} · {m.productName}</p>
                    <p className="text-xs text-muted-foreground">Ref: {m.reference}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{isPositive ? "+" : "-"}{m.quantity}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(m.timestamp), "MMM d, HH:mm")}</p>
                </div>
              </li>
            );
          })}
          {hasLoaded && !busy && movements.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No movement history yet.</li>
          )}
        </ul>
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
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col sm:max-w-xl p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/30">
            <DialogTitle>
              {isAssetRowChemical ? "Batch / Serial Numbers" : "Serial Numbers"} - {assetRow?.productName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 border-b border-border bg-background sticky top-0 z-10 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={isAssetRowChemical ? "Search batch / serial numbers..." : "Search serial numbers..."} 
                className="pl-9" 
                value={assetSearchQuery}
                onChange={(e) => setAssetSearchQuery(e.target.value)}
              />
            </div>
            {isAssetRowChemical && assetVariantOptions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Register one tag per physical container/bottle, tied to its packaging size. You cannot exceed that size&apos;s stock.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
            {assetsLoading && assets.length === 0 ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground h-6 w-6" /></div>
            ) : (
              <div className="space-y-2">
                {assets.filter(a => a.assetTag.toLowerCase().includes(assetSearchQuery.toLowerCase())).map(asset => (
                  <div key={asset.id} className="flex items-center justify-between p-3 border border-border bg-card rounded-md text-sm shadow-sm transition-all hover:shadow-md">
                    <div>
                      <p className="font-semibold">{asset.assetTag}</p>
                      <p className="text-xs text-muted-foreground">
                        {isAssetRowChemical && asset.variantLabel ? (
                          <span className="mr-2 font-medium text-foreground">{asset.variantLabel}</span>
                        ) : null}
                        {asset.condition || "No condition specified"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${asset.status === 'Available' ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'}`}>
                        {asset.status}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive-soft hover:text-destructive transition-colors" onClick={() => void handleDeleteAsset(asset.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {assets.length > 0 && assets.filter(a => a.assetTag.toLowerCase().includes(assetSearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm bg-card rounded-md border border-dashed border-border">
                    No serial numbers match your search.
                  </div>
                )}
                {assets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm bg-card rounded-md border border-dashed border-border">
                    {isAssetRowChemical ? "No batch/serial numbers registered yet." : "No serial numbers registered yet."}
                  </div>
                )}
              </div>
            )}
          </div>
            
          <div className="p-4 border-t border-border bg-card shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-10">
            <p className="font-medium text-sm mb-3">
              {isAssetRowChemical ? "Register new batch / serial number" : "Register new serial number"}
            </p>
            <div className="flex flex-col gap-2">
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
                    <SelectTrigger className={fieldErrors.assetVariantId ? "border-destructive" : ""}>
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
              <div className="space-y-1.5">
                <Label required className="text-xs">{isAssetRowChemical ? "Batch / Serial / Tag" : "Serial Number / Tag"}</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder={isAssetRowChemical ? "Batch / Serial / Tag" : "Serial Number / Tag"}
                    value={newAssetTag}
                    onChange={(e) => {
                      setNewAssetTag(e.target.value);
                      clearFieldError("assetTag");
                    }}
                    className={fieldErrors.assetTag ? "border-destructive" : ""}
                  />
                  <Input placeholder="Condition (Optional)" value={newAssetCondition} onChange={(e) => setNewAssetCondition(e.target.value)} />
                  <Button
                    onClick={() => void handleAddAsset()}
                    disabled={
                      assetsLoading ||
                      !newAssetTag.trim() ||
                      (isAssetRowChemical && (!newAssetVariantId || selectedAssetVariantRemaining <= 0))
                    }
                  >
                    Add
                  </Button>
                </div>
                <FieldError message={fieldErrors.assetTag} />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/30 sm:justify-between">
            <p className="text-xs text-muted-foreground self-center hidden sm:block">
              {assets.length} total items
            </p>
            <Button variant="outline" onClick={() => setAssetRow(null)}>Close</Button>
          </DialogFooter>
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


