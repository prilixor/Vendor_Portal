import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Skeleton } from "@/app/components/ui/skeleton";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { FieldError } from "@/app/components/shared/FieldError";
import { ServiceArea } from "@/app/models";
import { Plus, MapPin, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";
import { useAuth } from "@/app/guards/AuthContext";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { missingAddressFieldLabels } from "@/app/helpers/reverseGeocode";

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toUiArea = (a: Awaited<ReturnType<typeof vendorOnboardingApi.getVendorServiceAreas>>[number]): ServiceArea => ({
    id: a.id,
    name: a.areaName,
    city: a.city,
    latitude: a.centerLatitude,
    longitude: a.centerLongitude,
    radiusKm: a.serviceRadiusKm,
  });

  const startNew = () => { setFieldErrors({}); setEditing({ ...blank, id: `sa${Date.now()}` }); setOpen(true); };
  const startEdit = (a: ServiceArea) => { setFieldErrors({}); setEditing(a); setOpen(true); };
  const remove = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmRemove = async (id: string) => {
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
      setDeleteConfirmId(null);
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

    const errors: Record<string, string> = {};
    if (!editing.name?.trim()) {
      errors.name = "Please enter an area name.";
    }
    if (!editing.city?.trim()) {
      errors.city = "Please enter a city.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fill in the required fields.");
      return;
    }

    try {
      setBusy(true);
      setFieldErrors({});
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
        <div className="space-y-4">
          {/* Service Areas Grid Skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="flex gap-1">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing.id && areas.some((a) => a.id === editing.id) ? "Edit" : "New"} service area</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">
            Fields marked <span className="text-destructive">*</span> are required.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label required>Area name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => {
                    setEditing({ ...editing, name: e.target.value });
                    clearFieldError("name");
                  }}
                  placeholder="e.g. South Mumbai"
                  className={fieldErrors.name ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-1.5">
                <Label required>City</Label>
                <Input
                  value={editing.city}
                  onChange={(e) => {
                    setEditing({ ...editing, city: e.target.value });
                    clearFieldError("city");
                  }}
                  placeholder="Mumbai"
                  className={fieldErrors.city ? "border-destructive" : ""}
                />
                <FieldError message={fieldErrors.city} />
              </div>
            </div>
            {mapReady ? (
              <div className="w-full overflow-hidden rounded-xl">
                <MapPicker
                  key={`dialog-map-${editing.id}`}
                  latitude={editing.latitude}
                  longitude={editing.longitude}
                  radiusKm={editing.radiusKm}
                  showRadius
                  height="h-48 sm:h-72"
                  onChange={(lat, lng) => setEditing({ ...editing, latitude: lat, longitude: lng })}
                  onAddressResolved={(address) => {
                    const nextCity = address?.city || editing.city;
                    if (address?.city) {
                      setEditing((prev) => ({ ...prev, city: address.city! }));
                      clearFieldError("city");
                    }
                    const missing = missingAddressFieldLabels({
                      city: nextCity,
                      requireLine1: false,
                      requireState: false,
                      requirePostal: false,
                      requireCity: true,
                    });
                    if (missing.length === 0) {
                      toast.success("Location applied from map.");
                    } else {
                      toast.message(`Map pin saved. Please fill required ${missing.join(", ")}.`);
                    }
                  }}
                  onRadiusChange={(km) => setEditing({ ...editing, radiusKm: km })}
                />
              </div>
            ) : (
              <div className="h-48 sm:h-72 w-full rounded-xl border border-border bg-muted/30 animate-pulse" />
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save} disabled={busy} className="w-full sm:w-auto">Save area</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Card */}
      {deleteConfirmId && (() => {
        const area = areas.find(a => a.id === deleteConfirmId);
        if (!area) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full p-6 bg-white shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Delete Service Area</h3>
                  <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">Are you sure you want to delete this service area?</p>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-medium">{area.name}</p>
                  <p className="text-sm text-muted-foreground">{area.city} · {area.radiusKm} km radius</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmRemove(deleteConfirmId)}
                  className="flex-1"
                  disabled={busy}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
};

export default ServiceAreas;


