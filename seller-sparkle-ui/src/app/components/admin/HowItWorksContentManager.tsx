import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { websiteContentApi, HowItWorksStepDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Save,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Search,
  CheckCircle2,
  ShoppingBag,
  Truck,
  Stethoscope,
  FlaskConical,
  Building2,
  Upload,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

const PRESET_HIW_ICONS = [
  { value: "UserCheck", label: "User Check (Create Account)" },
  { value: "Search", label: "Search (Browse Solutions)" },
  { value: "CheckCircle2", label: "Check Circle (Choose Option)" },
  { value: "ShoppingBag", label: "Shopping Bag (Place Order)" },
  { value: "Truck", label: "Truck (Delivery & Support)" },
  { value: "Stethoscope", label: "Stethoscope (Medical Care)" },
  { value: "FlaskConical", label: "Flask (Chemicals)" },
  { value: "Building2", label: "Building (Bulk Quotes)" },
];

export function HowItWorksContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eyebrow, setEyebrow] = useState("HOW IT WORKS");
  const [title, setTitle] = useState("From browsing to ");
  const [accentText, setAccentText] = useState("delivery.");
  const [subtitle, setSubtitle] = useState("Five simple steps to get the equipment and supplies you need.");
  const [steps, setSteps] = useState<HowItWorksStepDto[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<HowItWorksStepDto | null>(null);

  const [formStepNumber, setFormStepNumber] = useState<number>(1);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIconMode, setFormIconMode] = useState<"preset" | "custom">("preset");
  const [formIcon, setFormIcon] = useState("UserCheck");
  const [formCustomUrl, setFormCustomUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full?.howItWorks?.header) {
        setEyebrow(full.howItWorks.header.eyebrow || "HOW IT WORKS");
        setTitle(full.howItWorks.header.title || "From browsing to ");
        setAccentText(full.howItWorks.header.accentText || "delivery.");
        setSubtitle(full.howItWorks.header.subtitle || "Five simple steps to get the equipment and supplies you need.");
      }
      setSteps(full?.howItWorks?.steps || []);
    } catch (err: any) {
      toast.error("Failed to load How It Works content: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveHeader = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateHowItWorksHeader({
        eyebrow: eyebrow.trim(),
        title: title.trim(),
        accentText: accentText.trim(),
        subtitle: subtitle.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["website-content"] });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("How It Works header updated successfully!");
    } catch (err: any) {
      toast.error("Failed to save header: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingStep(null);
    const nextStepNum = steps.length + 1;
    setFormStepNumber(nextStepNum);
    setFormTitle("");
    setFormDesc("");
    setFormIconMode("preset");
    setFormIcon("UserCheck");
    setFormCustomUrl("");
    setFormIsActive(true);
    setDialogOpen(true);
  };

  const handleOpenEdit = (stepItem: HowItWorksStepDto) => {
    setEditingStep(stepItem);
    setFormStepNumber(stepItem.stepNumber);
    setFormTitle(stepItem.title);
    setFormDesc(stepItem.description);
    if (stepItem.customIconUrl) {
      setFormIconMode("custom");
      setFormCustomUrl(stepItem.customIconUrl);
      setFormIcon(stepItem.iconName || "UserCheck");
    } else {
      setFormIconMode("preset");
      setFormIcon(stepItem.iconName || "UserCheck");
      setFormCustomUrl("");
    }
    setFormIsActive(stepItem.isActive);
    setDialogOpen(true);
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormCustomUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStep = async () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formDesc.trim()) {
      toast.error("Description is required");
      return;
    }

    setSaving(true);
    try {
      const maxAllowedStep = steps.length + (editingStep ? 0 : 1);
      const targetPos = Math.min(maxAllowedStep, Math.max(1, formStepNumber));

      const remainingSteps = steps
        .filter((s) => s.id !== editingStep?.id)
        .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));

      const targetStep: HowItWorksStepDto = {
        id: editingStep?.id,
        stepNumber: targetPos,
        title: formTitle.trim(),
        description: formDesc.trim(),
        iconName: formIconMode === "preset" ? formIcon : undefined,
        customIconUrl: formIconMode === "custom" ? formCustomUrl.trim() : undefined,
        sortOrder: targetPos,
        isActive: formIsActive,
      };

      const insertIdx = Math.min(targetPos - 1, remainingSteps.length);
      remainingSteps.splice(insertIdx, 0, targetStep);

      const resequenced = remainingSteps.map((item, idx) => ({
        ...item,
        stepNumber: idx + 1,
        sortOrder: idx + 1,
      }));

      for (const stepItem of resequenced) {
        const original = steps.find((s) => s.id === stepItem.id);
        if (
          !original ||
          original.stepNumber !== stepItem.stepNumber ||
          original.sortOrder !== stepItem.sortOrder ||
          stepItem.id === editingStep?.id
        ) {
          await websiteContentApi.upsertHowItWorksStep(stepItem);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["website-content"] });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(editingStep ? "Step updated!" : "Step added!");
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to save step: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (id?: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this step?")) return;

    setSaving(true);
    try {
      await websiteContentApi.deleteHowItWorksStep(id);

      const remaining = steps
        .filter((s) => s.id !== id)
        .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));

      const resequenced = remaining.map((item, idx) => ({
        ...item,
        stepNumber: idx + 1,
        sortOrder: idx + 1,
      }));

      for (const stepItem of resequenced) {
        const original = steps.find((s) => s.id === stepItem.id);
        if (original && (original.stepNumber !== stepItem.stepNumber || original.sortOrder !== stepItem.sortOrder)) {
          await websiteContentApi.upsertHowItWorksStep(stepItem);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["website-content"] });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Step deleted!");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to delete step: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const renderIconBadge = (item: HowItWorksStepDto) => {
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
        {item.iconName || "UserCheck"}
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
            <Wrench className="h-5 w-5 text-primary" /> How It Works Header Settings
          </CardTitle>
          <CardDescription>
            Configure the section title, eyebrow, and description displayed on the landing page How It Works section.
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
                placeholder="HOW IT WORKS"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Main Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="From browsing to "
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
                placeholder="delivery."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle Description</Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Five simple steps to get the equipment and supplies you need."
              />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* Steps List Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Dynamic Steps ({steps.length})</CardTitle>
              <CardDescription>
                Manage step cards shown on the landing page. Select a preset Lucide icon or upload a custom image.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" /> Add Step Card
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile Card List View */}
          <div className="space-y-3 sm:hidden">
            {steps.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                No steps added yet. Click Add Step Card to create your first step.
              </div>
            ) : (
              steps
                .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
                .map((item, idx) => (
                  <div key={item.id ?? idx} className="rounded-lg border p-4 space-y-3 bg-card shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Step #{item.stepNumber || idx + 1}
                        </span>
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
                          onClick={() => handleDeleteStep(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                        {item.isActive ? (
                          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2 shrink-0">
                            <Eye className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2 shrink-0">
                            <EyeOff className="h-3 w-3" /> Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
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
                  <TableHead className="w-[60px]">Step #</TableHead>
                  <TableHead className="w-[180px]">Icon / Image</TableHead>
                  <TableHead className="w-[200px]">Step Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px] text-center">Status</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No steps added yet. Click Add Step Card to create your first step.
                    </TableCell>
                  </TableRow>
                ) : (
                  steps
                    .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
                    .map((item, idx) => (
                      <TableRow key={item.id ?? idx}>
                        <TableCell className="font-mono text-xs font-semibold">{item.stepNumber || idx + 1}</TableCell>
                        <TableCell>{renderIconBadge(item)}</TableCell>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                          {item.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.isActive ? (
                            <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                              <Eye className="h-3 w-3" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                              <EyeOff className="h-3 w-3" /> Inactive
                            </Badge>
                          )}
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
                              onClick={() => handleDeleteStep(item.id)}
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
          {saving ? "Saving..." : "Save How It Works Content"}
        </Button>
      </div>

      {/* Add / Edit Step Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle>{editingStep ? "Edit Step Card" : "Add New Step Card"}</DialogTitle>
            <DialogDescription>
              Configure step title, description, display sequence position, and icon style.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto max-h-[58vh] pr-4 pl-1">
            <div className="space-y-2">
              <Label htmlFor="stepNumber">Step Number (Position)</Label>
              <Input
                id="stepNumber"
                type="number"
                min={1}
                max={steps.length + (editingStep ? 0 : 1)}
                value={formStepNumber}
                onChange={(e) => {
                  const maxVal = steps.length + (editingStep ? 0 : 1);
                  const parsed = parseInt(e.target.value);
                  if (isNaN(parsed)) {
                    setFormStepNumber(1);
                  } else {
                    setFormStepNumber(Math.min(maxVal, Math.max(1, parsed)));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Determines the step sequence. Inserting at an existing position automatically shifts remaining steps.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stepTitle">Step Title</Label>
              <Input
                id="stepTitle"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Create an Account"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stepDesc">Description</Label>
              <Textarea
                id="stepDesc"
                rows={3}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="e.g. Sign up on the Customer Portal in minutes."
              />
            </div>

            {/* Icon Mode Selection */}
            <div className="space-y-2 pt-1">
              <Label>Icon Style</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="iconMode"
                    checked={formIconMode === "preset"}
                    onChange={() => setFormIconMode("preset")}
                    className="accent-primary"
                  />
                  <span>Preset Icon</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="iconMode"
                    checked={formIconMode === "custom"}
                    onChange={() => setFormIconMode("custom")}
                    className="accent-primary"
                  />
                  <span>Custom Image / Icon Upload</span>
                </label>
              </div>
            </div>

            {formIconMode === "preset" ? (
              <div className="space-y-2">
                <Label>Select Preset Icon</Label>
                <Select value={formIcon} onValueChange={setFormIcon}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_HIW_ICONS.map((ic) => (
                      <SelectItem key={ic.value} value={ic.value}>
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-primary" />
                          <span>{ic.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <Label>Custom Icon Image (File Upload or Image URL)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="text"
                    placeholder="https://example.com/icon.svg or upload below"
                    value={formCustomUrl}
                    onChange={(e) => setFormCustomUrl(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  {formCustomUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormCustomUrl("")}
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="customIconFile"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-background border text-xs font-semibold rounded hover:bg-accent"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </Label>
                  <input
                    type="file"
                    id="customIconFile"
                    accept="image/*"
                    onChange={handleCustomFileUpload}
                    className="hidden"
                  />
                  <span className="text-xs text-muted-foreground">PNG, SVG, JPG (Max 2MB)</span>
                </div>

                {formCustomUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs font-medium text-muted-foreground">Preview:</span>
                    <img
                      src={formCustomUrl}
                      alt="preview"
                      className="w-8 h-8 object-contain rounded border p-1 bg-background"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <Label className="cursor-pointer flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                Active (Show on Landing Page)
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t mt-2 flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStep} disabled={saving}>
              {saving ? "Saving..." : editingStep ? "Update Step" : "Create Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
