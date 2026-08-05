import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { websiteContentApi, ServiceItemDto, ServicesHeaderDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Save,
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
  FlaskConical,
  Layers,
  Truck,
  Building2,
  ShieldCheck,
  Activity,
  HeartPulse,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const PRESET_SERVICE_ICONS = [
  { value: "Stethoscope", label: "Stethoscope (Medical Equipment)" },
  { value: "FlaskConical", label: "Flask (Laboratory Chemicals)" },
  { value: "Layers", label: "Layers (Healthcare Marketplace)" },
  { value: "Truck", label: "Truck (Delivery & Support)" },
  { value: "Building2", label: "Building (Bulk Procurement)" },
  { value: "ShieldCheck", label: "Shield Check (Verified Suppliers)" },
  { value: "Activity", label: "Activity (Rehab & Care)" },
  { value: "HeartPulse", label: "Heart Pulse (Diagnostics)" },
];

export function ServicesContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eyebrow, setEyebrow] = useState("OUR SERVICES");
  const [title, setTitle] = useState("Medical equipment & ");
  const [accentText, setAccentText] = useState("laboratory supplies.");
  const [subtitle, setSubtitle] = useState("Rent or buy equipment. Buy lab chemicals. All in one place.");
  const [services, setServices] = useState<ServiceItemDto[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItemDto | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIconMode, setFormIconMode] = useState<"preset" | "custom">("preset");
  const [formIcon, setFormIcon] = useState("Stethoscope");
  const [formCustomUrl, setFormCustomUrl] = useState("");

  const loadContent = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full && full.services) {
        if (full.services.eyebrow) setEyebrow(full.services.eyebrow);
        if (full.services.title) setTitle(full.services.title);
        if (full.services.accentText) setAccentText(full.services.accentText);
        if (full.services.subtitle) setSubtitle(full.services.subtitle);
        if (full.services.services) setServices(full.services.services);
      }
    } catch (err) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContent();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDesc("");
    setFormIconMode("preset");
    setFormIcon("Stethoscope");
    setFormCustomUrl("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: ServiceItemDto) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDesc(item.description);
    if (item.customIconUrl) {
      setFormIconMode("custom");
      setFormCustomUrl(item.customIconUrl);
      setFormIcon(item.iconName ?? "Stethoscope");
    } else {
      setFormIconMode("preset");
      setFormIcon(item.iconName ?? "Stethoscope");
      setFormCustomUrl("");
    }
    setDialogOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size should be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormCustomUrl(result);
      setFormIconMode("custom");
      toast.success("Custom service icon uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveService = async () => {
    if (!formTitle.trim() || !formDesc.trim()) {
      toast.error("Please enter both title and description.");
      return;
    }

    const customIconUrl = formIconMode === "custom" ? formCustomUrl.trim() : undefined;
    const payload: ServiceItemDto = {
      id: editingItem?.id,
      title: formTitle,
      description: formDesc,
      iconName: formIconMode === "preset" ? formIcon : "Stethoscope",
      customIconUrl,
      sortOrder: editingItem?.sortOrder ?? services.length + 1,
    };

    try {
      await websiteContentApi.upsertServiceItem(payload);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(`Saved service card "${formTitle}".`);
    } catch (err) {
      toast.error("Failed to save service card.");
    } finally {
      setDialogOpen(false);
    }
  };

  const handleDeleteService = async (id?: string, title?: string) => {
    if (!id) return;
    try {
      await websiteContentApi.deleteServiceItem(id);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.info(`Removed service "${title}".`);
    } catch (err) {
      toast.error("Failed to delete service card.");
    }
  };

  const handleSaveHeader = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateServicesHeader({
        eyebrow,
        title,
        accentText,
        subtitle,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Services section saved! Landing page synced.");
    } catch (err) {
      toast.error("Failed to save Services content.");
    } finally {
      setSaving(false);
    }
  };

  const renderIconBadge = (item: ServiceItemDto) => {
    if (item.customIconUrl) {
      return (
        <div className="flex items-center gap-2">
          <img src={item.customIconUrl} alt={item.title} className="h-6 w-6 object-contain rounded" />
          <span className="text-xs text-muted-foreground">(Custom Image)</span>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Wrench className="h-3.5 w-3.5 text-primary" />
        {item.iconName || "Stethoscope"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> Services Header Settings
          </CardTitle>
          <CardDescription>
            Configure the section title, eyebrow, and description displayed on the landing page Services section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="eyebrow">Eyebrow Tag</Label>
              <Input
                id="eyebrow"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Main Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </FormGrid>

          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="accentText">Accent Text (Teal)</Label>
              <Input
                id="accentText"
                value={accentText}
                onChange={(e) => setAccentText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle Description</Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* Services List Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Services Cards ({services.length})</CardTitle>
              <CardDescription>
                Manage service cards shown on the landing page. Select a preset Lucide icon or upload a custom image.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" /> Add Service Card
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Card List View */}
          <div className="space-y-3 sm:hidden">
            {services.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                No services added yet.
              </div>
            ) : (
              services.map((item, idx) => (
                <div key={item.id ?? idx} className="rounded-lg border p-4 space-y-3 bg-card shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                      {renderIconBadge(item)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteService(item.id, item.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block rounded-md border overflow-x-auto w-full max-w-full">
            <Table className="min-w-[550px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead className="w-[180px]">Icon / Image</TableHead>
                  <TableHead className="w-[200px]">Service Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No services added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((item, idx) => (
                    <TableRow key={item.id ?? idx}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell>{renderIconBadge(item)}</TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteService(item.id, item.title)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Save Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button onClick={handleSaveHeader} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Services Content"}
        </Button>
      </div>

      {/* Add / Edit Service Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit Service "${editingItem.title}"` : "Add Service Card"}
            </DialogTitle>
            <DialogDescription>
              Configure service title, description, and preset Lucide icon or custom image upload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="srvTitle">Service Title</Label>
              <Input
                id="srvTitle"
                placeholder="e.g. Medical Equipment Rental"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srvDesc">Description</Label>
              <Textarea
                id="srvDesc"
                rows={3}
                placeholder="Brief description of service offerings..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            {/* Icon / Image Selection */}
            <div className="space-y-3 pt-1 border-t">
              <Label>Service Icon / Image</Label>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="iconMode"
                    checked={formIconMode === "preset"}
                    onChange={() => setFormIconMode("preset")}
                  />
                  Preset Icon
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="iconMode"
                    checked={formIconMode === "custom"}
                    onChange={() => setFormIconMode("custom")}
                  />
                  Upload Custom Icon
                </label>
              </div>

              {formIconMode === "preset" ? (
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select preset icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_SERVICE_ICONS.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        {icon.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Click to upload custom icon image</span>
                    <span className="text-[10px] text-muted-foreground/70">PNG, JPG, SVG, WebP (max 2MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>

                  {formCustomUrl && (
                    <div className="flex items-center justify-between rounded border p-2 bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <img src={formCustomUrl} alt="Preview" className="h-6 w-6 object-contain rounded" />
                        <span className="truncate max-w-[200px]">Custom Image Loaded</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          setFormCustomUrl("");
                          setFormIconMode("preset");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveService}>
              {editingItem ? "Save Changes" : "Add Service Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
