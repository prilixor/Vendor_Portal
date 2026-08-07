import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { FormGrid } from "@/app/components/shared/FormGrid";
import { websiteContentApi } from "@/app/services/websiteContentApi";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Clock, FileText, Save, RotateCcw, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  INDIAN_MOBILE_MESSAGE,
  isValidIndianMobile,
  normalizeIndianMobileDigits,
} from "@/app/helpers/indianMobilePhone";

export function ContactContentManager() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [heroTitle, setHeroTitle] = useState("We are here to");
  const [heroAccent, setHeroAccent] = useState("help.");
  const [heroSub, setHeroSub] = useState("Reach our team directly. We respond quickly to every enquiry.");

  const [phone, setPhone] = useState("+91 8511225390");
  const [email, setEmail] = useState("info@blinksmed.com");
  const [operatingHours, setOperatingHours] = useState("Mon – Sat, 8:00 AM – 8:00 PM IST");
  const [institutionalNote, setInstitutionalNote] = useState(
    "For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly."
  );

  const [ctaTitle, setCtaTitle] = useState("Ready to rent or purchase medical equipment?");
  const [ctaDescription, setCtaDescription] = useState(
    "Enter the Customer Portal to browse, compare, and place your order."
  );
  const [ctaButtonText, setCtaButtonText] = useState("Get Started");
  const [ctaButtonLink, setCtaButtonLink] = useState("/customer/shop");

  const loadContent = async () => {
    setLoading(true);
    try {
      const full = await websiteContentApi.getAdminContent();
      if (full && full.contact) {
        if (full.contact.heroTitle) setHeroTitle(full.contact.heroTitle);
        if (full.contact.heroAccent) setHeroAccent(full.contact.heroAccent);
        if (full.contact.heroSub) setHeroSub(full.contact.heroSub);
        if (full.contact.phone) setPhone(full.contact.phone);
        if (full.contact.email) setEmail(full.contact.email);
        if (full.contact.operatingHours) setOperatingHours(full.contact.operatingHours);
        if (full.contact.institutionalNote) setInstitutionalNote(full.contact.institutionalNote);
        if (full.contact.ctaTitle) setCtaTitle(full.contact.ctaTitle);
        if (full.contact.ctaDescription) setCtaDescription(full.contact.ctaDescription);
        if (full.contact.ctaButtonText) setCtaButtonText(full.contact.ctaButtonText);
        if (full.contact.ctaButtonLink) setCtaButtonLink(full.contact.ctaButtonLink);
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

  const handleSave = async () => {
    if (!isValidIndianMobile(phone)) {
      toast.error(INDIAN_MOBILE_MESSAGE);
      return;
    }
    const displayPhone = `+91 ${normalizeIndianMobileDigits(phone)}`;
    setSaving(true);
    try {
      await websiteContentApi.updateContactContent({
        heroTitle,
        heroAccent,
        heroSub,
        phone: displayPhone,
        email,
        operatingHours,
        institutionalNote,
        ctaTitle,
        ctaDescription,
        ctaButtonText,
        ctaButtonLink,
      });
      await queryClient.invalidateQueries({ queryKey: ["publicWebsiteContent"] });
      toast.success("Contact section saved! Landing page synced.");
    } catch (err) {
      toast.error("Failed to save Contact content.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setHeroTitle("We are here to");
    setHeroAccent("help.");
    setHeroSub("Reach our team directly. We respond quickly to every enquiry.");
    setPhone("+91 98765 43210");
    setEmail("hello@blinksmed.com");
    setOperatingHours("Mon – Sat, 8:00 AM – 8:00 PM IST");
    setInstitutionalNote(
      "For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly."
    );
    setCtaTitle("Ready to rent or purchase medical equipment?");
    setCtaDescription("Enter the Customer Portal to browse, compare, and place your order.");
    setCtaButtonText("Get Started");
    setCtaButtonLink("/customer/shop");
    toast.info("Contact content reset to defaults.");
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
      {/* Header Banner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Contact Section Header
          </CardTitle>
          <CardDescription>
            Configure the title and intro copy for the contact section on the landing page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="cHeroTitle">Headline Title</Label>
              <Input
                id="cHeroTitle"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cHeroAccent">Accent Highlight Text (Italic Teal)</Label>
              <Input
                id="cHeroAccent"
                value={heroAccent}
                onChange={(e) => setHeroAccent(e.target.value)}
              />
            </div>
          </FormGrid>

          <div className="space-y-2">
            <Label htmlFor="cHeroSub">Subtitle</Label>
            <Input
              id="cHeroSub"
              value={heroSub}
              onChange={(e) => setHeroSub(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Direct Contact Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information Cards</CardTitle>
          <CardDescription>
            Configure direct telephone numbers, email addresses, and operating hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid numCols={3}>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Indian mobile (10 digits starting with 6–9). Saved as +91…
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Business Operating Hours
              </Label>
              <Input
                id="hours"
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
              />
            </div>
          </FormGrid>

          <div className="space-y-2">
            <Label htmlFor="institutionalNote">Institutional / Bulk Orders Note</Label>
            <Textarea
              id="institutionalNote"
              rows={2}
              value={institutionalNote}
              onChange={(e) => setInstitutionalNote(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom CTA Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" /> Bottom Call-to-Action Panel
          </CardTitle>
          <CardDescription>
            Configure the prominent callout banner displayed at the bottom of the contact section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="ctaTitle">CTA Panel Title</Label>
              <Input
                id="ctaTitle"
                value={ctaTitle}
                onChange={(e) => setCtaTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaButtonText">Button Label</Label>
              <Input
                id="ctaButtonText"
                value={ctaButtonText}
                onChange={(e) => setCtaButtonText(e.target.value)}
              />
            </div>
          </FormGrid>

          <FormGrid numCols={2}>
            <div className="space-y-2">
              <Label htmlFor="ctaDesc">Description Text</Label>
              <Input
                id="ctaDesc"
                value={ctaDescription}
                onChange={(e) => setCtaDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaLink">Target Link URL</Label>
              <Input
                id="ctaLink"
                value={ctaButtonLink}
                onChange={(e) => setCtaButtonLink(e.target.value)}
              />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* Save Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset Defaults
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving Changes..." : "Save Contact Content"}
        </Button>
      </div>
    </div>
  );
}
