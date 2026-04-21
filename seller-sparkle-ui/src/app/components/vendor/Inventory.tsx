import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { StatCard } from "@/app/components/shared/StatCard";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { mockInventory, mockMovements } from "@/app/services/mockData";
import { InventoryMovement, InventoryRecord } from "@/app/models";
import { Boxes, CheckCircle2, Clock, Package, Lock, ArrowDownRight, ArrowUpRight, Pause, Play, Ban, Pencil, Plus, Minus } from "lucide-react";
import { format } from "date-fns";

const movementMeta = {
  in: { label: "Stock In", icon: ArrowDownRight, cls: "bg-success-soft text-success" },
  out: { label: "Stock Out", icon: ArrowUpRight, cls: "bg-info-soft text-info" },
  reserved: { label: "Reserved", icon: Pause, cls: "bg-warning-soft text-warning" },
  released: { label: "Released", icon: Play, cls: "bg-primary-soft text-primary" },
  blocked: { label: "Blocked", icon: Ban, cls: "bg-destructive-soft text-destructive" },
};

const INVENTORY_STORAGE_KEY = "vendor_inventory_records";
const INVENTORY_MOVEMENTS_STORAGE_KEY = "vendor_inventory_movements";

const Inventory = () => {
  const [inventory, setInventory] = useState<InventoryRecord[]>(() => {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return mockInventory;
    try {
      const parsed = JSON.parse(raw) as InventoryRecord[];
      if (!Array.isArray(parsed)) return mockInventory;
      return parsed;
    } catch {
      return mockInventory;
    }
  });
  const [editingRow, setEditingRow] = useState<InventoryRecord | null>(null);
  const [editForm, setEditForm] = useState({ total: 0, reserved: 0, rented: 0, blocked: 0 });
  const [movements, setMovements] = useState<InventoryMovement[]>(() => {
    const raw = localStorage.getItem(INVENTORY_MOVEMENTS_STORAGE_KEY);
    if (!raw) return mockMovements;
    try {
      const parsed = JSON.parse(raw) as InventoryMovement[];
      if (!Array.isArray(parsed)) return mockMovements;
      return parsed;
    } catch {
      return mockMovements;
    }
  });
  const [movementRow, setMovementRow] = useState<InventoryRecord | null>(null);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementQtyInput, setMovementQtyInput] = useState("1");

  useEffect(() => {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);
  useEffect(() => {
    localStorage.setItem(INVENTORY_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
  }, [movements]);

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

  const saveEdit = () => {
    if (!editingRow) return;
    const cappedReserved = Math.min(editForm.reserved, editForm.total);
    const cappedRented = Math.min(editForm.rented, Math.max(0, editForm.total - cappedReserved));
    const cappedBlocked = Math.min(editForm.blocked, Math.max(0, editForm.total - cappedReserved - cappedRented));
    const nextAvailable = Math.max(0, editForm.total - cappedReserved - cappedRented - cappedBlocked);

    setInventory((prev) =>
      prev.map((row) =>
        row.productId === editingRow.productId
          ? {
              ...row,
              total: editForm.total,
              reserved: cappedReserved,
              rented: cappedRented,
              blocked: cappedBlocked,
              available: nextAvailable,
            }
          : row
      )
    );
    setEditingRow(null);
  };

  const openMovement = (row: InventoryRecord, type: "in" | "out") => {
    setMovementRow(row);
    setMovementType(type);
    setMovementQtyInput("1");
  };

  const saveMovement = () => {
    if (!movementRow) return;
    const parsedQty = Number(movementQtyInput);
    const qty = Number.isFinite(parsedQty) ? Math.max(1, Math.floor(parsedQty)) : 1;

    setInventory((prev) =>
      prev.map((row) => {
        if (row.productId !== movementRow.productId) return row;
        if (movementType === "in") {
          return {
            ...row,
            total: row.total + qty,
            available: row.available + qty,
          };
        }
        const removable = Math.min(qty, row.available);
        return {
          ...row,
          total: Math.max(0, row.total - removable),
          available: Math.max(0, row.available - removable),
        };
      })
    );

    const refPrefix = movementType === "in" ? "ADD" : "REM";
    const movement: InventoryMovement = {
      id: `m-${Date.now()}`,
      productName: movementRow.productName,
      type: movementType,
      quantity: qty,
      reference: `${refPrefix}-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
    };
    setMovements((prev) => [movement, ...prev]);
    setMovementRow(null);
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

      <Card className="mt-6 border-border/60">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Stock by product</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                        <Button variant="ghost" size="icon" onClick={() => openMovement(row, "in")} aria-label={`Add stock for ${row.productName}`}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openMovement(row, "out")} aria-label={`Remove stock for ${row.productName}`}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.productName} stock`}>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              Available (auto): <span className="font-semibold">{computedAvailable}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementRow} onOpenChange={(open) => !open && setMovementRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movementType === "in" ? "Stock Added" : "Stock Removed"} - {movementRow?.productName}</DialogTitle>
          </DialogHeader>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementRow(null)}>
              Cancel
            </Button>
            <Button onClick={saveMovement}>{movementType === "in" ? "Add Stock" : "Remove Stock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;


