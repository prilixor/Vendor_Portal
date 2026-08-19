import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
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
import { websiteContentApi, RentVsBuyFeatureRowDto, RentVsBuyCardDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Save,
  Plus,
  Pencil,
  Trash2,
  Table as TableIcon,
  HelpCircle,
  FileText,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";

export function RentVsBuyContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eyebrow, setEyebrow] = useState("RENT OR BUY");
  const [title, setTitle] = useState("Choose what fits your");
  const [accentText, setAccentText] = useState("care timeline.");
  const [subtitle, setSubtitle] = useState(
    "Rent medical equipment on weekly or monthly plans for shorter recovery periods. Buy when long-term ownership is the practical choice. We help you compare options without making it confusing."
  );

  const [features, setFeatures] = useState<RentVsBuyFeatureRowDto[]>([]);
  const [cards, setCards] = useState<RentVsBuyCardDto[]>([]);

  // Modal states for Feature Row
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<RentVsBuyFeatureRowDto | null>(null);
  const [formFeatureLabel, setFormFeatureLabel] = useState("");
  const [formWeeklyValue, setFormWeeklyValue] = useState("");
  const [formMonthlyValue, setFormMonthlyValue] = useState("");
  const [formPurchaseValue, setFormPurchaseValue] = useState("");

  // Modal states for Guidance Card
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<RentVsBuyCardDto | null>(null);
  const [formCardTitle, setFormCardTitle] = useState("");
  const [formCardDesc, setFormCardDesc] = useState("");

  const loadContent = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full && full.rentVsBuy) {
        if (full.rentVsBuy.eyebrow) setEyebrow(full.rentVsBuy.eyebrow);
        if (full.rentVsBuy.title) setTitle(full.rentVsBuy.title);
        if (full.rentVsBuy.accentText) setAccentText(full.rentVsBuy.accentText);
        if (full.rentVsBuy.subtitle) setSubtitle(full.rentVsBuy.subtitle);
        if (full.rentVsBuy.features) setFeatures(full.rentVsBuy.features);
        if (full.rentVsBuy.cards) setCards(full.rentVsBuy.cards);
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

  // --- Feature Row Actions ---
  const handleOpenAddFeature = () => {
    setEditingFeature(null);
    setFormFeatureLabel("");
    setFormWeeklyValue("");
    setFormMonthlyValue("");
    setFormPurchaseValue("");
    setFeatureDialogOpen(true);
  };

  const handleOpenEditFeature = (item: RentVsBuyFeatureRowDto) => {
    setEditingFeature(item);
    setFormFeatureLabel(item.featureLabel);
    setFormWeeklyValue(item.weeklyValue);
    setFormMonthlyValue(item.monthlyValue);
    setFormPurchaseValue(item.purchaseValue);
    setFeatureDialogOpen(true);
  };

  const handleSaveFeature = async () => {
    if (!formFeatureLabel.trim()) {
      toast.error("Please enter a feature row label.");
      return;
    }

    const payload: RentVsBuyFeatureRowDto = {
      id: editingFeature?.id,
      featureLabel: formFeatureLabel,
      weeklyValue: formWeeklyValue,
      monthlyValue: formMonthlyValue,
      purchaseValue: formPurchaseValue,
      sortOrder: editingFeature?.sortOrder ?? features.length + 1,
    };

    try {
      await websiteContentApi.upsertRentVsBuyFeature(payload);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(`Saved feature row "${formFeatureLabel}".`);
    } catch (err) {
      toast.error("Failed to save feature row.");
    } finally {
      setFeatureDialogOpen(false);
    }
  };

  const handleDeleteFeature = async (id?: string, label?: string) => {
    if (!id) return;
    try {
      await websiteContentApi.deleteRentVsBuyFeature(id);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.info(`Removed feature row "${label}".`);
    } catch (err) {
      toast.error("Failed to delete feature row.");
    }
  };

  // --- Guidance Card Actions ---
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setFormCardTitle("");
    setFormCardDesc("");
    setCardDialogOpen(true);
  };

  const handleOpenEditCard = (item: RentVsBuyCardDto) => {
    setEditingCard(item);
    setFormCardTitle(item.title);
    setFormCardDesc(item.description);
    setCardDialogOpen(true);
  };

  const handleSaveCard = async () => {
    if (!formCardTitle.trim() || !formCardDesc.trim()) {
      toast.error("Please enter both card title and description.");
      return;
    }

    const payload: RentVsBuyCardDto = {
      id: editingCard?.id,
      title: formCardTitle,
      description: formCardDesc,
      sortOrder: editingCard?.sortOrder ?? cards.length + 1,
    };

    try {
      await websiteContentApi.upsertRentVsBuyCard(payload);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success(`Saved guidance card "${formCardTitle}".`);
    } catch (err) {
      toast.error("Failed to save guidance card.");
    } finally {
      setCardDialogOpen(false);
    }
  };

  const handleDeleteCard = async (id?: string, title?: string) => {
    if (!id) return;
    try {
      await websiteContentApi.deleteRentVsBuyCard(id);
      await loadContent();
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.info(`Removed card "${title}".`);
    } catch (err) {
      toast.error("Failed to delete card.");
    }
  };

  // --- Header Save Action ---
  const handleSaveHeader = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateRentVsBuyHeader({
        eyebrow,
        title,
        accentText,
        subtitle,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Rent or Buy section header saved! Landing page synced.");
    } catch (err) {
      toast.error("Failed to save Rent or Buy content.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="header" className="w-full">
        <div className="w-full max-w-full">
          <TabsList className="grid grid-cols-3 sm:inline-flex h-auto p-1 w-full sm:w-auto sm:min-w-max gap-1">
            <TabsTrigger value="header" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Header Banner</span>
            </TabsTrigger>
            <TabsTrigger value="matrix" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <TableIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Matrix ({features.length})</span>
            </TabsTrigger>
            <TabsTrigger value="guidance" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Cards ({cards.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Header Banner */}
        <TabsContent value="header" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" /> Rent or Buy Section Header
              </CardTitle>
              <CardDescription>
                Configure section title, eyebrow, and introductory text on the landing page Rent or Buy section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormGrid numCols={2}>
                <div className="space-y-2">
                  <Label htmlFor="rvbEyebrow">Eyebrow Tag</Label>
                  <Input
                    id="rvbEyebrow"
                    value={eyebrow}
                    onChange={(e) => setEyebrow(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rvbTitle">Main Headline First Part</Label>
                  <Input
                    id="rvbTitle"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </FormGrid>

              <FormGrid numCols={2}>
                <div className="space-y-2">
                  <Label htmlFor="rvbAccent">Accent Highlight Text (Italic Teal)</Label>
                  <Input
                    id="rvbAccent"
                    value={accentText}
                    onChange={(e) => setAccentText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rvbSubtitle">Section Subtitle / Description</Label>
                  <Textarea
                    id="rvbSubtitle"
                    rows={2}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>
              </FormGrid>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Comparison Matrix Table */}
        <TabsContent value="matrix" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Comparison Matrix Rows ({features.length})</CardTitle>
                  <CardDescription>
                    Manage feature criteria comparing Weekly Rental, Monthly Rental, and Direct Purchase.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAddFeature}>
                  <Plus className="mr-2 h-4 w-4" /> Add Feature Row
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Card List View */}
              <div className="space-y-3 sm:hidden">
                {features.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                    No feature rows added yet.
                  </div>
                ) : (
                  features.map((item, idx) => (
                    <div key={item.id ?? idx} className="rounded-lg border p-4 space-y-3 bg-card shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEditFeature(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteFeature(item.id, item.featureLabel)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-semibold text-sm text-foreground">{item.featureLabel}</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Weekly</span>
                          <span className="font-medium">{item.weeklyValue || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Monthly</span>
                          <span className="font-medium">{item.monthlyValue || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">Purchase</span>
                          <span className="font-medium">{item.purchaseValue || "-"}</span>
                        </div>
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
                      <TableHead className="w-[180px]">Feature Label</TableHead>
                      <TableHead>Weekly Rental</TableHead>
                      <TableHead>Monthly Rental</TableHead>
                      <TableHead>Purchase</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No feature rows added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      features.map((item, idx) => (
                        <TableRow key={item.id ?? idx}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{item.featureLabel}</TableCell>
                          <TableCell className="text-xs">{item.weeklyValue}</TableCell>
                          <TableCell className="text-xs">{item.monthlyValue}</TableCell>
                          <TableCell className="text-xs">{item.purchaseValue}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEditFeature(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteFeature(item.id, item.featureLabel)}
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

        {/* Tab 3: Guidance Cards */}
        <TabsContent value="guidance" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Guidance Comparison Cards ({cards.length})</CardTitle>
                  <CardDescription>
                    Manage decision guidance cards (e.g. "When should I rent?" / "When should I buy?").
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAddCard}>
                  <Plus className="mr-2 h-4 w-4" /> Add Guidance Card
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile Card List View */}
              <div className="space-y-3 sm:hidden">
                {cards.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg p-4">
                    No guidance cards added yet.
                  </div>
                ) : (
                  cards.map((item, idx) => (
                    <div key={item.id ?? idx} className="rounded-lg border p-4 space-y-3 bg-card shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEditCard(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteCard(item.id, item.title)}
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
                      <TableHead className="w-[220px]">Card Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No guidance cards added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cards.map((item, idx) => (
                        <TableRow key={item.id ?? idx}>
                          <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{item.title}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.description}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEditCard(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCard(item.id, item.title)}
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
        <Button onClick={handleSaveHeader} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Rent or Buy Content"}
        </Button>
      </div>

      {/* Add / Edit Feature Row Dialog */}
      <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFeature ? `Edit Feature "${editingFeature.featureLabel}"` : "Add Comparison Feature Row"}
            </DialogTitle>
            <DialogDescription>
              Configure feature label and corresponding values for Weekly, Monthly, and Purchase options.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fLabel">Feature Label</Label>
              <Input
                id="fLabel"
                placeholder="e.g. Upfront cost"
                value={formFeatureLabel}
                onChange={(e) => setFormFeatureLabel(e.target.value)}
              />
            </div>

            <FormGrid numCols={3}>
              <div className="space-y-2">
                <Label htmlFor="wVal">Weekly Rental</Label>
                <Input
                  id="wVal"
                  placeholder="e.g. Lowest"
                  value={formWeeklyValue}
                  onChange={(e) => setFormWeeklyValue(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mVal">Monthly Rental</Label>
                <Input
                  id="mVal"
                  placeholder="e.g. Low"
                  value={formMonthlyValue}
                  onChange={(e) => setFormMonthlyValue(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pVal">Purchase</Label>
                <Input
                  id="pVal"
                  placeholder="e.g. Full price"
                  value={formPurchaseValue}
                  onChange={(e) => setFormPurchaseValue(e.target.value)}
                />
              </div>
            </FormGrid>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFeature}>
              {editingFeature ? "Save Changes" : "Add Feature Row"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Guidance Card Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? `Edit Guidance Card "${editingCard.title}"` : "Add Guidance Card"}
            </DialogTitle>
            <DialogDescription>
              Configure card question title and detailed decision advice text.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cTitle">Card Title</Label>
              <Input
                id="cTitle"
                placeholder="e.g. When should I rent?"
                value={formCardTitle}
                onChange={(e) => setFormCardTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cDesc">Guidance Description</Label>
              <Textarea
                id="cDesc"
                rows={3}
                placeholder="For recovery, rehabilitation, or any short-term need..."
                value={formCardDesc}
                onChange={(e) => setFormCardDesc(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCard}>
              {editingCard ? "Save Changes" : "Add Guidance Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
