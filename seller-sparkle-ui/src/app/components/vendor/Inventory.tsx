import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { StatCard } from "@/app/components/shared/StatCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { InventoryMovement, InventoryRecord } from "@/app/models";
import { Boxes, CheckCircle2, Clock, Package, Lock, ArrowDownRight, ArrowUpRight, Pause, Play, Ban, Pencil, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { toast } from "sonner";

const movementMeta = {
  in: { label: "Stock In", icon: ArrowDownRight, cls: "bg-success-soft text-success" },
  out: { label: "Stock Out", icon: ArrowUpRight, cls: "bg-info-soft text-info" },
  reserved: { label: "Reserved", icon: Pause, cls: "bg-warning-soft text-warning" },
  released: { label: "Released", icon: Play, cls: "bg-primary-soft text-primary" },
  blocked: { label: "Blocked", icon: Ban, cls: "bg-destructive-soft text-destructive" },
};

const Inventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [editingRow, setEditingRow] = useState<InventoryRecord | null>(null);
  const [editForm, setEditForm] = useState({ total: 0, reserved: 0, rented: 0, blocked: 0 });
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementRow, setMovementRow] = useState<InventoryRecord | null>(null);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementQtyInput, setMovementQtyInput] = useState("1");
  const [busy, setBusy] = useState(false);

  const loadInventory = async () => {
    if (!user) return;

    const [listings, products] = await Promise.all([
      vendorOnboardingApi.getVendorProductListings(user.id),
      vendorOnboardingApi.getProducts(),
    ]);

    const productById = new Map(products.map((p) => [p.id, p.productName]));

    const rows = await Promise.all(
      listings.map(async (listing) => {
        try {
          const inv = await vendorOnboardingApi.getVendorInventory(user.id, listing.id);
          return {
            productId: listing.id,
            productName: `${listing.listingTitle}${productById.get(listing.productId) ? ` (${productById.get(listing.productId)})` : ""}`,
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
            productName: `${listing.listingTitle}${productById.get(listing.productId) ? ` (${productById.get(listing.productId)})` : ""}`,
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
            timestamp: x.createdAt || new Date().toISOString(),
          } satisfies InventoryMovement));
        } catch {
          return [] as InventoryMovement[];
        }
      })
    );

    setMovements(movementRows.flat());
  };

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      setBusy(true);
      try {
        await loadInventory();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load inventory.";
        toast.error(message);
      } finally {
        setBusy(false);
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

  const openEdit = (row: InventoryRecord) => {
    setEditingRow(row);
    setEditForm({
      total: row.total,
      reserved: row.reserved,
      rented: row.rented,
      blocked: row.blocked,
    });
  };

  const updateFormValue = (field: "total" | "reserved" | "rented" | "blocked", value: string) => {
    const parsed = Number(value);
    setEditForm((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0,
    }));
  };

  const computedAvailable = Math.max(0, editForm.total - editForm.reserved - editForm.rented - editForm.blocked);

  const saveEdit = async () => {
    if (!editingRow || !user) return;
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
      await loadInventory();
      setEditingRow(null);
      toast.success("Inventory updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update inventory.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const openMovement = (row: InventoryRecord, type: "in" | "out") => {
    setMovementRow(row);
    setMovementType(type);
    setMovementQtyInput("1");
  };

  const saveMovement = async () => {
    if (!movementRow || !user) return;
    const parsedQty = Number(movementQtyInput);
    const qty = Number.isFinite(parsedQty) ? Math.max(1, Math.floor(parsedQty)) : 1;

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

      await loadInventory();
      setMovementRow(null);
      toast.success(movementType === "in" ? "Stock added." : "Stock removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save movement.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Inventory" description="Track stock levels and movements across all your products." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total" value={totals.total} icon={Boxes} accent="primary" />
        <StatCard label="Available" value={totals.available} icon={CheckCircle2} accent="success" />
        <StatCard label="Reserved" value={totals.reserved} icon={Clock} accent="warning" />
        <StatCard label="Rented" value={totals.rented} icon={Package} accent="info" />
        <StatCard label="Blocked" value={totals.blocked} icon={Lock} accent="primary" />
      </div>

      <Card className="mt-6 border-border/60 p-4 sm:p-6 lg:p-8">
        <div className="border-b border-border pb-4">
          <h2 className="font-semibold">Stock by product</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Available</th>
                <th className="px-4 py-3 font-semibold text-right">Reserved</th>
                <th className="px-4 py-3 font-semibold text-right">Rented</th>
                <th className="px-4 py-3 font-semibold text-right">Blocked</th>
                <th className="px-4 py-3 font-semibold">Utilization</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inventory.map((row) => {
                const utilization = row.total === 0 ? 0 : ((row.rented + row.reserved) / row.total) * 100;
                return (
                  <tr key={row.productId} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.productName}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.total}</td>
                    <td className="px-4 py-3 text-right font-mono text-success">{row.available}</td>
                    <td className="px-4 py-3 text-right font-mono text-warning">{row.reserved}</td>
                    <td className="px-4 py-3 text-right font-mono text-info">{row.rented}</td>
                    <td className="px-4 py-3 text-right font-mono text-destructive">{row.blocked}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-gradient-primary" style={{ width: `${utilization}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openMovement(row, "in")} aria-label={`Add stock for ${row.productName}`} disabled={busy}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openMovement(row, "out")} aria-label={`Remove stock for ${row.productName}`} disabled={busy}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.productName} stock`} disabled={busy}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 border-border/60">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Movement history</h2>
        </div>
        <ul className="divide-y divide-border">
          {movements.map((m) => {
            const meta = movementMeta[m.type];
            const Icon = meta.icon;
            const isPositive = m.type === "in" || m.type === "released";
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.cls}`}>
                    <Icon className="h-4 w-4" />
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
        </ul>
      </Card>

      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit stock - {editingRow?.productName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <FormGrid cols={2}>
            <div className="space-y-1.5">
              <Label>Total</Label>
              <Input type="number" min={0} value={editForm.total} onChange={(e) => updateFormValue("total", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reserved</Label>
              <Input type="number" min={0} value={editForm.reserved} onChange={(e) => updateFormValue("reserved", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rented</Label>
              <Input type="number" min={0} value={editForm.rented} onChange={(e) => updateFormValue("rented", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Blocked</Label>
              <Input type="number" min={0} value={editForm.blocked} onChange={(e) => updateFormValue("blocked", e.target.value)} />
            </div>
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              Available (auto): <span className="font-semibold">{computedAvailable}</span>
            </div>
          </FormGrid>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={busy}>Save stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementRow} onOpenChange={(open) => !open && setMovementRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movementType === "in" ? "Stock Added" : "Stock Removed"} - {movementRow?.productName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-1">
            <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={movementQtyInput}
              onChange={(e) => setMovementQtyInput(e.target.value)}
            />
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
            <Button onClick={() => void saveMovement()} disabled={busy}>{movementType === "in" ? "Add Stock" : "Remove Stock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;

const toUiMovementType = (type: string): InventoryMovement["type"] => {
  const value = type.trim().toLowerCase();
  if (value === "stock_added" || value === "in") return "in";
  if (value === "stock_removed" || value === "out") return "out";
  if (value === "reservation_released" || value === "released") return "released";
  if (value === "reserved" || value === "blocked") return value;
  if (value === "unblocked") return "released";
  if (value === "rented") return "out";
  if (value === "returned") return "in";
  if (value === "corrected") return "in";
  if (value === "reservation_released") return "released";
  if (value === "in" || value === "out" || value === "released") {
    return value;
  }
  return "in";
};


