import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { websiteContentApi, HomeFeatureDto } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  CalendarRange,
  Headphones,
  Truck,
  Award,
  Clock,
  Heart,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";

const PRESET_FEATURE_ICONS = [
  { value: "ShieldCheck", label: "Shield Check (Verified)" },
  { value: "CalendarRange", label: "Calendar Range (Flexibility)" },
  { value: "Headphones", label: "Headphones (Support)" },
  { value: "Truck", label: "Truck (Delivery)" },
  { value: "Award", label: "Award (Quality)" },
  { value: "Clock", label: "Clock (24/7 Service)" },
  { value: "Heart", label: "Heart (Patient Care)" },
  { value: "Sparkles", label: "Sparkles (Premium)" },
];

export function HomeContentManager() {
  const queryClient = useQueryClient();
  const [heroTitle, setHeroTitle] = useState("A trusted marketplace for");
  const [heroAccent, setHeroAccent] = useState("medical equipment & supplies.");
  const [heroSubtitle, setHeroSubtitle] = useState(
    "BlinksMed connects you with verified suppliers to rent or purchase medical equipment and source laboratory chemicals, all through one simple, trusted platform. Delivery, setup, and expert support are included at every step."
  );
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState("Get Started");
  const [primaryCtaLink, setPrimaryCtaLink] = useState("/customer/shop");
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState("Learn How It Works");
  const [secondaryCtaLink, setSecondaryCtaLink] = useState("/#how-it-works");
  const [trustLabel, setTrustLabel] = useState(
    "TRUSTED BY HEALTHCARE PROFESSIONALS, CLINICS, HOSPITALS & LABORATORIES"
  );
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);

  const [features, setFeatures] = useState<HomeFeatureDto[]>([
    {
      id: "f1",
      title: "Verified Suppliers",
      subtitle: "Every partner vetted for quality",
      iconName: "ShieldCheck",
    },
    {
      id: "f2",
      title: "Flexible Rental Options",
      subtitle: "Weekly, monthly, or ownership",
      iconName: "CalendarRange",
    },
    {
      id: "f3",
      title: "Expert Customer Support",
      subtitle: "Guidance at every step",
      iconName: "Headphones",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        const data = await websiteContentApi.getAdminContent();
        if (data && data.home) {
          if (data.home.heroTitle) setHeroTitle(data.home.heroTitle);
          if (data.home.heroAccent) setHeroAccent(data.home.heroAccent);
          if (data.home.heroSubtitle) setHeroSubtitle(data.home.heroSubtitle);
          if (data.home.primaryCtaLabel) setPrimaryCtaLabel(data.home.primaryCtaLabel);
          if (data.home.primaryCtaLink) setPrimaryCtaLink(data.home.primaryCtaLink);
          if (data.home.secondaryCtaLabel) setSecondaryCtaLabel(data.home.secondaryCtaLabel);
          if (data.home.secondaryCtaLink) setSecondaryCtaLink(data.home.secondaryCtaLink);
          if (data.home.trustLabel) setTrustLabel(data.home.trustLabel);
          if (data.home.heroImageUrl) setHeroImageUrl(data.home.heroImageUrl);
          if (data.home.features && data.home.features.length > 0) setFeatures(data.home.features);
        }
      } catch (err) {
        // Offline / fallback defaults
      } finally {
        setLoading(false);
      }
    };
    void loadContent();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateHomeContent({
        heroTitle,
        heroAccent,
        heroSubtitle,
        primaryCtaLabel,
        primaryCtaLink,
        secondaryCtaLabel,
        secondaryCtaLink,
        trustLabel,
        heroImageUrl: heroImageUrl || undefined,
        features,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Home section updated! Landing page synced.");
    } catch (err) {
      toast.error("Failed to save home content to database.");
    } finally {
      setSaving(false);
    }
  };

  const handleHeroImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Hero image file size must be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setHeroImageUrl(result);
      toast.success("Hero image uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setHeroTitle("A trusted marketplace for");
    setHeroAccent("medical equipment & supplies.");
    setHeroSubtitle(
      "BlinksMed connects you with verified suppliers to rent or purchase medical equipment and source laboratory chemicals, all through one simple, trusted platform. Delivery, setup, and expert support are included at every step."
    );
    setPrimaryCtaLabel("Get Started");
    setPrimaryCtaLink("/customer/shop");
    setSecondaryCtaLabel("Learn How It Works");
    setSecondaryCtaLink("/#how-it-works");
    setTrustLabel("TRUSTED BY HEALTHCARE PROFESSIONALS, CLINICS, HOSPITALS & LABORATORIES");
    setHeroImageUrl(null);
    toast.info("Content reset to defaults.");
  };

  const handleFeatureChange = (id: string, field: keyof HomeFeatureDto, value: any) => {
    setFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleImageUpload = (id: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      handleFeatureChange(id, "customIconUrl", result);
      toast.success("Custom icon uploaded.");
    };
    reader.readAsDataURL(file);
  };

  const handleAddFeature = () => {
    const newFeature: HomeFeatureDto = {
      id: `f_${Date.now()}`,
      title: "New Feature Highlight",
      subtitle: "Feature description summary",
      iconName: "ShieldCheck",
    };
    setFeatures((prev) => [...prev, newFeature]);
    toast.success("New feature block added.");
  };

  const handleDeleteFeature = (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
    toast.info("Feature block removed.");
  };

  if (loading) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="h-5 w-5 text-primary" />
                Hero Banner Settings
              </CardTitle>
              <CardDescription>
                Configure main headline, text, call-to-action buttons, trust bar, and hero banner graphic/image.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Database Synced
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Headline First Part</Label>
              <Input
                id="heroTitle"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="A trusted marketplace for"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heroAccent">Accent Highlight Text (Gradient)</Label>
              <Input
                id="heroAccent"
                value={heroAccent}
                onChange={(e) => setHeroAccent(e.target.value)}
                placeholder="medical equipment & supplies."
              />
            </div>
          </FormGrid>

          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Hero Subtitle / Description</Label>
            <Textarea
              id="heroSubtitle"
              rows={3}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Detailed description of BlinksMed platform..."
            />
          </div>

          <FormGrid numCols={3}>
            <div className="space-y-2">
              <Label htmlFor="primaryCtaLabel">Primary CTA Button Label</Label>
              <Input
                id="primaryCtaLabel"
                value={primaryCtaLabel}
                onChange={(e) => setPrimaryCtaLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryCtaLink">Primary CTA Link Target</Label>
              <Input
                id="primaryCtaLink"
                value={primaryCtaLink}
                onChange={(e) => setPrimaryCtaLink(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryCtaLabel">Secondary CTA Button Label</Label>
              <Input
                id="secondaryCtaLabel"
                value={secondaryCtaLabel}
                onChange={(e) => setSecondaryCtaLabel(e.target.value)}
              />
            </div>
          </FormGrid>

          <div className="space-y-2 pt-2">
            <Label htmlFor="trustLabel">Trust Bar Label</Label>
            <Input
              id="trustLabel"
              value={trustLabel}
              onChange={(e) => setTrustLabel(e.target.value)}
            />
          </div>

          {/* Hero Banner Image Graphic Selector */}
          <div className="space-y-2 pt-3 border-t">
            <Label className="flex items-center gap-1.5 font-medium">
              <ImageIcon className="h-4 w-4 text-primary" /> Hero Banner Right Image / Graphic
            </Label>
            <p className="text-xs text-muted-foreground">
              Upload a custom hero photo/graphic to replace the default vector illustration on the right side of the hero section.
            </p>

            {heroImageUrl ? (
              <div className="relative rounded-lg border bg-muted/20 p-3 max-w-md">
                <div className="flex h-52 w-full items-center justify-center rounded-md border bg-background/80 p-2 overflow-hidden">
                  <img
                    src={heroImageUrl}
                    alt="Hero Preview"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">Custom Hero Image Loaded</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full sm:w-auto text-destructive hover:bg-destructive/10"
                    onClick={() => setHeroImageUrl(null)}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Remove & Use Default Graphic
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-lg border border-dashed p-6 max-w-md cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">Click to upload custom hero banner image</span>
                <span className="text-xs text-muted-foreground">PNG, JPG, SVG, WebP (max 5MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleHeroImageUpload(file);
                  }}
                />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Highlights Grid */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Feature Highlights</CardTitle>
              <CardDescription>
                Manage the key feature badges displayed directly below the hero section banner. Select a preset icon or upload a custom image.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddFeature}>
              <Plus className="mr-2 h-4 w-4" /> Add Feature Block
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((item, idx) => (
              <div key={item.id ?? idx} className="relative rounded-lg border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Feature #{idx + 1}</span>
                  {features.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => item.id && handleDeleteFeature(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Feature Title</Label>
                  <Input
                    value={item.title}
                    onChange={(e) => item.id && handleFeatureChange(item.id, "title", e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Subtitle</Label>
                  <Input
                    value={item.subtitle}
                    onChange={(e) => item.id && handleFeatureChange(item.id, "subtitle", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Icon Selection & Custom Image Upload */}
                <div className="space-y-2 pt-1 border-t">
                  <Label className="text-xs">Feature Icon / Image</Label>
                  <Select
                    value={item.customIconUrl ? "custom" : item.iconName || "ShieldCheck"}
                    onValueChange={(val) => {
                      if (val === "custom") return;
                      item.id && handleFeatureChange(item.id, "customIconUrl", null);
                      item.id && handleFeatureChange(item.id, "iconName", val);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_FEATURE_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                      {item.customIconUrl && <SelectItem value="custom">Custom Image Uploaded</SelectItem>}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 pt-1">
                    {item.customIconUrl ? (
                      <div className="flex items-center justify-between w-full rounded border bg-muted/30 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <img src={item.customIconUrl} alt="Custom Icon" className="h-6 w-6 object-contain rounded" />
                          <span className="truncate max-w-[120px] text-muted-foreground">Custom Icon</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => item.id && handleFeatureChange(item.id, "customIconUrl", null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload Custom Icon</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && item.id) handleImageUpload(item.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset Defaults
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving Changes..." : "Save Home Content"}
        </Button>
      </div>
    </div>
  );
}
