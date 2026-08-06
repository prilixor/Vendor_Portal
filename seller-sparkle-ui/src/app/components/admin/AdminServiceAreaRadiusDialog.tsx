import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { adminApi, type VendorServiceAreaDto } from "@/app/services/adminApi";
import { getUserFriendlyMessage } from "@/app/utils/errorMessages";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const getAdminUserId = () => {
  const adminUser = localStorage.getItem("adminUser");
  if (!adminUser) return null;
  try {
    const parsed = JSON.parse(adminUser) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
};

type AdminServiceAreaRadiusDialogProps = {
  vendorId: string;
  area: VendorServiceAreaDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: VendorServiceAreaDto) => void;
};

export function AdminServiceAreaRadiusDialog({
  vendorId,
  area,
  open,
  onOpenChange,
  onSaved,
}: AdminServiceAreaRadiusDialogProps) {
  const [radiusDraftKm, setRadiusDraftKm] = useState(5);
  const [radiusSaving, setRadiusSaving] = useState(false);
  const [radiusMapReady, setRadiusMapReady] = useState(false);

  useEffect(() => {
    if (!open || !area) {
      setRadiusMapReady(false);
      return;
    }
    setRadiusDraftKm(area.serviceRadiusKm > 0 ? area.serviceRadiusKm : 5);
    const timer = window.setTimeout(() => setRadiusMapReady(true), 180);
    return () => window.clearTimeout(timer);
  }, [open, area]);

  const save = async () => {
    if (!area) return;
    if (!(radiusDraftKm > 0) || radiusDraftKm > 500) {
      toast.error("Radius must be between 1 and 500 km.");
      return;
    }
    const adminUserId = getAdminUserId();
    if (!adminUserId) {
      toast.error("Admin session not found. Please login again.");
      return;
    }

    setRadiusSaving(true);
    try {
      const updated = await adminApi.updateVendorServiceAreaRadius({
        adminUserId,
        vendorId,
        serviceAreaId: area.id,
        serviceRadiusKm: radiusDraftKm,
      });
      onSaved(updated);
      onOpenChange(false);
      toast.success(`Service radius set to ${updated.serviceRadiusKm} km.`);
    } catch (error) {
      toast.error(getUserFriendlyMessage(error));
    } finally {
      setRadiusSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && radiusSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set service area radius</DialogTitle>
        </DialogHeader>
        {area && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{area.areaName}</p>
              <p className="text-xs text-muted-foreground">
                {area.city} · pin {area.centerLatitude.toFixed(4)}, {area.centerLongitude.toFixed(4)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Confirm the vendor location on the map, then choose the coverage radius for this area.
            </p>
            {radiusMapReady ? (
              <MapPicker
                key={`admin-radius-${area.id}`}
                latitude={area.centerLatitude}
                longitude={area.centerLongitude}
                radiusKm={radiusDraftKm}
                showRadius
                maxRadiusKm={100}
                radiusPresetsKm={[15, 30, 50, 100]}
                height="h-56 sm:h-72"
                onRadiusChange={setRadiusDraftKm}
              />
            ) : (
              <div className="h-56 sm:h-72 w-full rounded-xl border border-border bg-muted/30 animate-pulse" />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="admin-service-radius-km">Radius (km)</Label>
              <Input
                id="admin-service-radius-km"
                type="number"
                min={1}
                max={500}
                step={1}
                value={radiusDraftKm}
                onChange={(e) => setRadiusDraftKm(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">Allowed range: 1–500 km.</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={radiusSaving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={radiusSaving || !area}>
            {radiusSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save radius"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
