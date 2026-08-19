import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { websiteContentApi } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Save,
  Globe,
  FileText,
  Stethoscope,
  Layers,
  HelpCircle,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";

export function WebsiteSettingsManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showLandingPage, setShowLandingPage] = useState(true);
  const [showAboutSection, setShowAboutSection] = useState(true);
  const [showServicesSection, setShowServicesSection] = useState(true);
  const [showHowItWorksSection, setShowHowItWorksSection] = useState(true);
  const [showRentVsBuySection, setShowRentVsBuySection] = useState(true);
  const [showFaqSection, setShowFaqSection] = useState(true);
  const [showContactSection, setShowContactSection] = useState(true);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full && full.settings) {
        setShowLandingPage(full.settings.showLandingPage ?? true);
        setShowAboutSection(full.settings.showAboutSection ?? true);
        setShowServicesSection(full.settings.showServicesSection ?? true);
        setShowHowItWorksSection(full.settings.showHowItWorksSection ?? true);
        setShowRentVsBuySection(full.settings.showRentVsBuySection ?? true);
        setShowFaqSection(full.settings.showFaqSection ?? true);
        setShowContactSection(full.settings.showContactSection ?? true);
      }
    } catch (err) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await websiteContentApi.updateWebsiteSettings({
        showLandingPage,
        showAboutSection,
        showServicesSection,
        showHowItWorksSection,
        showRentVsBuySection,
        showFaqSection,
        showContactSection,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Portal settings saved successfully! Landing page updated.");
    } catch (err) {
      toast.error("Failed to save portal settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoaderSlot />;
  }

  return (
    <div className="space-y-6">
      {/* Card 1: Landing Page Master Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" /> Landing Page Master Settings
          </CardTitle>
          <CardDescription>
            Master control for public landing page accessibility and root URL redirection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="showLandingPageToggle" className="text-base font-semibold cursor-pointer">
                  Enable Landing Page
                </Label>
                {showLandingPage ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Disabled (Redirect Active)
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {showLandingPage
                  ? "Visitors accessing root URL (http://localhost:5173/) will view the Public Landing Page."
                  : "Visitors accessing root URL (http://localhost:5173/) will be automatically redirected to /customer/shop."}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Switch
                id="showLandingPageToggle"
                checked={showLandingPage}
                onCheckedChange={(val) => setShowLandingPage(val)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Landing Page Section Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Landing Page Sections Visibility
          </CardTitle>
          <CardDescription>
            Control which sections are rendered on the public landing page and displayed in the header navigation menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Section 1: Home (Required) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">Home Section</span>
                  <Badge variant="secondary" className="text-[11px] gap-1 py-0 px-2">
                    <Lock className="h-3 w-3 text-muted-foreground" /> Required
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Main Hero banner & feature block section.</p>
              </div>
            </div>
            <Switch checked={true} disabled={true} />
          </div>

          {/* Section 2: About (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">About Section</span>
                  {showAboutSection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Banner, Mission & Vision, and Who We Serve cards.</p>
              </div>
            </div>
            <Switch
              checked={showAboutSection}
              onCheckedChange={(val) => setShowAboutSection(val)}
            />
          </div>

          {/* Section 3: Services (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">Services Section</span>
                  {showServicesSection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Service offerings grid cards.</p>
              </div>
            </div>
            <Switch
              checked={showServicesSection}
              onCheckedChange={(val) => setShowServicesSection(val)}
            />
          </div>

          {/* Section: How It Works (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">How It Works Section</span>
                  {showHowItWorksSection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Step-by-step customer ordering process cards.</p>
              </div>
            </div>
            <Switch
              checked={showHowItWorksSection}
              onCheckedChange={(val) => setShowHowItWorksSection(val)}
            />
          </div>

          {/* Section 4: Rent or Buy (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">Rent or Buy Section</span>
                  {showRentVsBuySection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Rental vs purchase comparison matrix and decision cards.</p>
              </div>
            </div>
            <Switch
              checked={showRentVsBuySection}
              onCheckedChange={(val) => setShowRentVsBuySection(val)}
            />
          </div>

          {/* Section 5: FAQ (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">FAQ Section</span>
                  {showFaqSection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Frequently asked questions accordion block.</p>
              </div>
            </div>
            <Switch
              checked={showFaqSection}
              onCheckedChange={(val) => setShowFaqSection(val)}
            />
          </div>

          {/* Section 6: Contact (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">Contact Section</span>
                  {showContactSection ? (
                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 py-0 px-2">
                      <Eye className="h-3 w-3" /> Visible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground gap-1 py-0 px-2">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Contact details card, operating hours, and bottom call-to-action.</p>
              </div>
            </div>
            <Switch
              checked={showContactSection}
              onCheckedChange={(val) => setShowContactSection(val)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button onClick={handleSaveAll} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving Settings..." : "Save Portal Settings"}
        </Button>
      </div>
    </div>
  );
}
