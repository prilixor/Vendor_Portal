import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { websiteContentApi, AudienceCategoryDto, AboutContentDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Save,
  Plus,
  Pencil,
  Trash2,
  Users,
  Target,
  Eye,
  User,
  Building2,
  Hospital,
  FlaskConical,
  Stethoscope,
  Activity,
  Microscope,
  HeartPulse,
  Award,
  Upload,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";

const PRESET_AUDIENCE_ICONS = [
  { value: "User", label: "User / Individual" },
  { value: "Users", label: "Users / Family" },
  { value: "Building2", label: "Building / Hospital" },
  { value: "Hospital", label: "Hospital / Clinic" },
  { value: "FlaskConical", label: "Flask / Laboratory" },
  { value: "Stethoscope", label: "Stethoscope / Professional" },
  { value: "Activity", label: "Activity / Rehab" },
  { value: "Microscope", label: "Microscope / Research" },
  { value: "HeartPulse", label: "Heart Pulse / Care" },
  { value: "Award", label: "Award / Quality" },
];

export function AboutContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bannerTitle, setBannerTitle] = useState("A simpler way to access");
  const [bannerAccent, setBannerAccent] = useState("healthcare products.");
  const [bannerSub, setBannerSub] = useState(
    "We exist to make sourcing healthcare products safer and more transparent, so hospitals, clinics, and families can rely on every supplier we work with."
  );
  const [missionTitle, setMissionTitle] = useState("Our Mission");
  const [missionText, setMissionText] = useState(
    "To make healthcare products more accessible through technology, trusted suppliers, and a seamless customer experience, removing the friction from renting, buying, and sourcing what care requires."
  );
  const [visionTitle, setVisionTitle] = useState("Our Vision");
  const [visionText, setVisionText] = useState(
    "To become one of the most trusted healthcare marketplaces, simplifying how medical equipment and laboratory products are accessed by individuals and institutions alike."
  );
  const [audiences, setAudiences] = useState<AudienceCategoryDto[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AudienceCategoryDto | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIconMode, setFormIconMode] = useState<"preset" | "custom">("preset");
  const [formIcon, setFormIcon] = useState("User");
  const [formCustomUrl, setFormCustomUrl] = useState("");

  const loadContent = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full && full.about) {
        if (full.about.bannerTitle) setBannerTitle(full.about.bannerTitle);
        if (full.about.bannerAccent) setBannerAccent(full.about.bannerAccent);
        if (full.about.bannerSub) setBannerSub(full.about.bannerSub);
        if (full.about.missionTitle) setMissionTitle(full.about.missionTitle);
        if (full.about.missionText) setMissionText(full.about.missionText);
        if (full.about.visionTitle) setVisionTitle(full.about.visionTitle);
        if (full.about.visionText) setVisionText(full.about.visionText);
        if (full.about.audiences) setAudiences(full.about.audiences);
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
    setFormIcon("User");
    setFormCustomUrl("");
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: AudienceCategoryDto) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDesc(item.description);
    if (item.customIconUrl) {
      setFormIconMode("custom");
      setFormCustomUrl(item.customIconUrl);
      setFormIcon(item.iconName ?? "User");
    } else {
      setFormIconMode("preset");
      setFormIcon(item.iconName ?? "User");
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
      toast.success("Custom audience icon uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAudience = async () => {
    if (!formTitle.trim() || !formDesc.trim()) {
      toast.error("Please enter both title and description.");
      return;
    }

    const customIconUrl = formIconMode === "custom" ? formCustomUrl.trim() : undefined;
    const payload: AudienceCategoryDto = {
      id: editingItem?.id,
      title: formTitle,
      description: formDesc,
      iconName: formIconMode === "preset" ? formIcon : "User",
      customIconUrl,
      sortOrder: editingItem?.sortOrder ?? audiences.length + 1,
    };

    try {
      await websiteContentApi.upsertAudienceCategory(payload);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(`Saved audience category "${formTitle}".`);
    } catch (err) {
      toast.error("Failed to save audience category.");
    } finally {
      setDialogOpen(false);
    }
  };

  const handleDeleteAudience = async (id?: string, title?: string) => {
    if (!id) return;
    try {
      await websiteContentApi.deleteAudienceCategory(id);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.info(`Removed "${title}".`);
    } catch (err) {
      toast.error("Failed to delete audience category.");
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateAboutContent({
        bannerTitle,
        bannerAccent,
        bannerSub,
        missionTitle,
        missionText,
        visionTitle,
        visionText,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("About Us page content saved! Landing page synced.");
    } catch (err) {
      toast.error("Failed to save About Us content.");
    } finally {
      setSaving(false);
    }
  };

  const renderIconBadge = (item: AudienceCategoryDto) => {
    if (item.customIconUrl) {
      return (
        <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
          <img src={item.customIconUrl} alt={item.title} className="h-4 w-4 object-contain rounded shrink-0" />
          <span>Custom Image</span>
        </div>
      );
    }

    const iconMap: Record<string, any> = {
      User: User,
      Users: Users,
      Building2: Building2,
      Hospital: Hospital,
      FlaskConical: FlaskConical,
      Stethoscope: Stethoscope,
      Activity: Activity,
      Microscope: Microscope,
      HeartPulse: HeartPulse,
      Award: Award,
    };

    const IconComp = iconMap[item.iconName || "User"] || User;

    return (
      <div className="inline-flex items-center gap-2 rounded-md bg-muted/40 border px-2.5 py-1 text-xs font-medium text-foreground">
        <IconComp className="h-4 w-4 text-primary shrink-0" />
        <span className="font-mono text-[11px] text-muted-foreground">{item.iconName || "User"}</span>
      </div>
    );
  };

  if (loading) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="banner" className="w-full">
        <div className="w-full max-w-full">
          <TabsList className="grid grid-cols-3 sm:inline-flex h-auto p-1 w-full sm:w-auto sm:min-w-max gap-1">
            <TabsTrigger value="banner" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Header Banner</span>
            </TabsTrigger>
            <TabsTrigger value="mission-vision" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Mission & Vision</span>
            </TabsTrigger>
            <TabsTrigger value="who-we-serve" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Who We Serve ({audiences.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Header Banner */}
        <TabsContent value="banner" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Page Header Banner</CardTitle>
              <CardDescription>
                Configure the top banner text shown on the About section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormGrid numCols={2}>
                <div className="space-y-2">
                  <Label htmlFor="bannerTitle">Headline First Part</Label>
                  <Input
                    id="bannerTitle"
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bannerAccent">Accent Highlight Text (Teal)</Label>
                  <Input
                    id="bannerAccent"
                    value={bannerAccent}
                    onChange={(e) => setBannerAccent(e.target.value)}
                  />
                </div>
              </FormGrid>

              <div className="space-y-2">
                <Label htmlFor="bannerSub">Banner Subtitle / Statement</Label>
                <Textarea
                  id="bannerSub"
                  rows={3}
                  value={bannerSub}
                  onChange={(e) => setBannerSub(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Mission & Vision */}
        <TabsContent value="mission-vision" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mission & Vision Statements</CardTitle>
              <CardDescription>
                Define the core purpose and long-term vision of BlinksMed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Target className="h-4 w-4" /> Mission Settings
                </div>
                <FormGrid numCols={1}>
                  <div className="space-y-2">
                    <Label htmlFor="missionTitle">Mission Title</Label>
                    <Input
                      id="missionTitle"
                      value={missionTitle}
                      onChange={(e) => setMissionTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="missionText">Mission Statement</Label>
                    <Textarea
                      id="missionText"
                      rows={3}
                      value={missionText}
                      onChange={(e) => setMissionText(e.target.value)}
                    />
                  </div>
                </FormGrid>
              </div>

              <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <Eye className="h-4 w-4" /> Vision Settings
                </div>
                <FormGrid numCols={1}>
                  <div className="space-y-2">
                    <Label htmlFor="visionTitle">Vision Title</Label>
                    <Input
                      id="visionTitle"
                      value={visionTitle}
                      onChange={(e) => setVisionTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visionText">Vision Statement</Label>
                    <Textarea
                      id="visionText"
                      rows={3}
                      value={visionText}
                      onChange={(e) => setVisionText(e.target.value)}
                    />
                  </div>
                </FormGrid>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Who We Serve */}
        <TabsContent value="who-we-serve" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Target Audience Categories ("Who We Serve")</CardTitle>
                  <CardDescription>
                    Manage target audience segments displayed on the landing page about section.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAdd}>
                  <Plus className="mr-2 h-4 w-4" /> Add Audience Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Card List View */}
              <div className="space-y-3 sm:hidden">
                {audiences.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                    No audience categories added yet.
                  </div>
                ) : (
                  audiences.map((item, idx) => (
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
                            onClick={() => handleDeleteAudience(item.id, item.title)}
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
                      <TableHead className="w-[200px]">Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audiences.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No audience categories added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      audiences.map((item, idx) => (
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
                                onClick={() => handleDeleteAudience(item.id, item.title)}
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
        </TabsContent>
      </Tabs>

      {/* Save Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button onClick={handleSaveAll} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save About Us Content"}
        </Button>
      </div>

      {/* Add / Edit Audience Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit Category "${editingItem.title}"` : "Add Target Audience Category"}
            </DialogTitle>
            <DialogDescription>
              Configure the audience title, description, and preset Lucide icon or custom image upload.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="audTitle">Audience Category Title</Label>
              <Input
                id="audTitle"
                placeholder="e.g. Healthcare Professionals"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audDesc">Description</Label>
              <Textarea
                id="audDesc"
                rows={3}
                placeholder="Brief description of service for this group..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            {/* Icon / Image Selection */}
            <div className="space-y-3 pt-1 border-t">
              <Label>Category Icon / Image</Label>

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
                    {PRESET_AUDIENCE_ICONS.map((icon) => (
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
            <Button onClick={handleSaveAudience}>
              {editingItem ? "Save Changes" : "Add Audience Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
