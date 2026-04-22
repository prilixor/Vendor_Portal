import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { ServiceArea } from "@/app/models";
import { Plus, MapPin, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";

const blank: ServiceArea = { id: "", name: "", city: "", latitude: 19.07, longitude: 72.87, radiusKm: 5 };

const ServiceAreas = () => {
  const { user } = useAuth();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea>(blank);
  const [mapReady, setMapReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const toUiArea = (a: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorServiceAreas>>[number]): ServiceArea => ({
    id: a.id,
    name: a.areaName,
    city: a.city,
    latitude: a.centerLatitude,
    longitude: a.centerLongitude,
    radiusKm: a.serviceRadiusKm,
  });

  const startNew = () => { setEditing({ ...blank, id: `sa${Date.now()}` }); setOpen(true); };
  const startEdit = (a: ServiceArea) => { setEditing(a); setOpen(true); };
  const remove = async (id: string) => {
    if (!user) {
      toast.error("Please login again.");
      return;
    }

    try {
      setBusy(true);
      await vendorOnboardingApi.deleteVendorServiceArea(user.id, id);
      const latest = await vendorOnboardingApi.getVendorServiceAreas(user.id);
      setAreas(latest.map(toUiArea));
      toast.success("Service area deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete service area.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!user) {
      toast.error("Please login again.");
      return;
    }

    if (!editing.name || !editing.city) { toast.error("Name and city are required"); return; }

    try {
      setBusy(true);
      const exists = areas.some((p) => p.id === editing.id);

      if (exists) {
        await vendorOnboardingApi.updateVendorServiceArea(user.id, editing.id, {
          vendorId: user.id,
          serviceAreaId: editing.id,
          areaName: editing.name,
          city: editing.city,
          centerLatitude: editing.latitude,
          centerLongitude: editing.longitude,
          serviceRadiusKm: editing.radiusKm,
          isActive: true,
        });
      } else {
        await vendorOnboardingApi.createVendorServiceArea(user.id, {
          vendorId: user.id,
          areaName: editing.name,
          city: editing.city,
          centerLatitude: editing.latitude,
          centerLongitude: editing.longitude,
          serviceRadiusKm: editing.radiusKm,
          isActive: true,
        });
      }

      const latest = await vendorOnboardingApi.getVendorServiceAreas(user.id);
      setAreas(latest.map(toUiArea));
      setOpen(false);
      toast.success("Service area saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save service area.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setMapReady(true);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!user) return;

    const loadServiceAreas = async () => {
      setBusy(true);
      setLoadError(null);
      try {
        const rows = await vendorOnboardingApi.getVendorServiceAreas(user.id);
        setAreas(rows.map(toUiArea));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load service areas.";
        setLoadError(message);
        toast.error(message);
      } finally {
        setBusy(false);
        setHasLoaded(true);
      }
    };

    void loadServiceAreas();
  }, [user]);

  return (
    <div>
      <PageHeader
        title="Service areas"
        description="Define the locations where you fulfill rentals. Customers in these zones will see your listings."
        actions={
          <Button onClick={startNew} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" /> Add service area
          </Button>
        }
      />

      {!hasLoaded && busy && (
        <Card className="mb-4 border-border/60 p-4 text-sm text-muted-foreground">Loading service areas...</Card>
      )}
      {loadError && (
        <Card className="mb-4 border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive">{loadError}</Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {areas.map((area) => (
          <Card key={area.id} className="overflow-hidden border-border/60 hover:shadow-elegant transition-all">
            <div className="bg-gradient-soft p-1">
              <MapPicker latitude={area.latitude} longitude={area.longitude} radiusKm={area.radiusKm} showRadius height="h-40" />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{area.name}</h3>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {area.city} · {area.radiusKm} km radius
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(area)} disabled={busy}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(area.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {hasLoaded && !busy && areas.length === 0 && (
        <Card className="mt-4 border-border/60 p-6 text-center text-sm text-muted-foreground">
          No service areas added yet.
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing.id && areas.some((a) => a.id === editing.id) ? "Edit" : "New"} service area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Area name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. South Mumbai" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Mumbai" />
              </div>
            </div>
            {mapReady ? (
              <MapPicker
                key={`dialog-map-${editing.id}`}
                latitude={editing.latitude}
                longitude={editing.longitude}
                radiusKm={editing.radiusKm}
                showRadius
                onChange={(lat, lng) => setEditing({ ...editing, latitude: lat, longitude: lng })}
                onRadiusChange={(km) => setEditing({ ...editing, radiusKm: km })}
              />
            ) : (
              <div className="h-72 rounded-xl border border-border bg-muted/30 animate-pulse" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save} disabled={busy}>Save area</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceAreas;


