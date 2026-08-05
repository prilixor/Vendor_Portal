import { useState, useEffect } from "react";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { HomeContentManager } from "./HomeContentManager";
import { AboutContentManager } from "./AboutContentManager";
import { ServicesContentManager } from "./ServicesContentManager";
import { RentVsBuyContentManager } from "./RentVsBuyContentManager";
import { FAQContentManager } from "./FAQContentManager";
import { ContactContentManager } from "./ContactContentManager";
import { HowItWorksContentManager } from "./HowItWorksContentManager";
import { WebsiteSettingsManager } from "./WebsiteSettingsManager";
import { Globe, FileText, Stethoscope, Layers, HelpCircle, PhoneCall, Settings as SettingsIcon, LayoutTemplate, Wrench } from "lucide-react";

interface WebsiteContentManagementProps {
  initialTab?: "home" | "about" | "services" | "how-it-works" | "rent-or-buy" | "faq" | "contact" | "settings";
}

export default function WebsiteContentManagement({ initialTab = "home" }: WebsiteContentManagementProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Portal Content Management"
        description="Manage public landing pages, hero banners, about statements, services, how it works steps, rent/buy options, FAQs, contact details, and portal settings."
        icon={LayoutTemplate}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full max-w-full">
          <TabsList className="grid grid-cols-4 sm:inline-flex h-auto p-1 w-full sm:w-auto sm:min-w-max gap-1">
            <TabsTrigger value="home" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Home</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">About</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Services</span>
            </TabsTrigger>
            <TabsTrigger value="how-it-works" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">How It Works</span>
            </TabsTrigger>
            <TabsTrigger value="rent-or-buy" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Rent or Buy</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <PhoneCall className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 text-xs sm:text-sm">
              <SettingsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="home" className="space-y-4">
          <HomeContentManager />
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <AboutContentManager />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <ServicesContentManager />
        </TabsContent>

        <TabsContent value="how-it-works" className="space-y-4">
          <HowItWorksContentManager />
        </TabsContent>

        <TabsContent value="rent-or-buy" className="space-y-4">
          <RentVsBuyContentManager />
        </TabsContent>

        <TabsContent value="faq" className="space-y-4">
          <FAQContentManager />
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <ContactContentManager />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <WebsiteSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}


