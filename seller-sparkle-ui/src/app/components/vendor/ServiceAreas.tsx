import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { MapPicker } from "@/app/components/shared/MapPicker";
import { mockServiceAreas } from "@/app/services/mockData";
import { ServiceArea } from "@/app/models";
import { Plus, MapPin, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog";

const blank: ServiceArea = { id: "", name: "", city: "", latitude: 19.07, longitude: 72.87, radiusKm: 5 };

const ServiceAreas = () => {
  const [areas, setAreas] = useState<ServiceArea[]>(mockServiceAreas);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceArea>(blank);
  const [mapReady, setMapReady] = useState(false);

  const startNew = () => { setEditing({ ...blank, id: `sa${Date.now()}` }); setOpen(true); };
  const startEdit = (a: ServiceArea) => { setEditing(a); setOpen(true); };
  const remove = (id: string) => { setAreas((a) => a.filter((x) => x.id !== id)); toast.success("Service area removed"); };

  const save = () => {
    if (!editing.name || !editing.city) { toast.error("Name and city are required"); return; }
    setAreas((prev) => {
      const exists = prev.some((p) => p.id === editing.id);
      return exists ? prev.map((p) => (p.id === editing.id ? editing : p)) : [...prev, editing];
    });
    setOpen(false);
    toast.success("Service area saved");
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
                  <Button variant="ghost" size="icon" onClick={() => startEdit(area)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(area.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save}>Save area</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceAreas;


