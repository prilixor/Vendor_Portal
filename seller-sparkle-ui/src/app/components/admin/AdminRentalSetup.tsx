import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/app/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import AdminRentalDurations from "@/app/components/admin/AdminRentalDurations";
import AdminRentalDurationIcons from "@/app/components/admin/AdminRentalDurationIcons";
import { CalendarRange, ImagePlus } from "lucide-react";

const TAB_VALUES = ["durations", "icons"] as const;
type RentalSetupTab = (typeof TAB_VALUES)[number];

const isRentalSetupTab = (value: string | null): value is RentalSetupTab =>
  !!value && (TAB_VALUES as readonly string[]).includes(value);

/**
 * Single Catalog entry for rental pricing masters: billing-cycle durations + value-tier icons.
 * Panels stay mounted (forceMount) so tab switches do not remount/refetch and flicker.
 */
const AdminRentalSetup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: RentalSetupTab = useMemo(() => {
    const queryTab = searchParams.get("tab");
    return isRentalSetupTab(queryTab) ? queryTab : "durations";
  }, [searchParams]);

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = isRentalSetupTab(value) ? value : "durations";
      const next = new URLSearchParams(searchParams);
      if (tab === "durations") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rental Setup"
        description="Manage billing-cycle durations and value-tier icons used on product rental pricing charts."
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-10 w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="durations" className="min-w-0 text-xs sm:min-w-[9.5rem] sm:text-sm">
            <CalendarRange className="mr-1 h-4 w-4 shrink-0 sm:mr-2" />
            <span className="truncate">Durations</span>
          </TabsTrigger>
          <TabsTrigger value="icons" className="min-w-0 text-xs sm:min-w-[9.5rem] sm:text-sm">
            <ImagePlus className="mr-1 h-4 w-4 shrink-0 sm:mr-2" />
            <span className="truncate">Icons</span>
          </TabsTrigger>
        </TabsList>

        {/* Keep both panels mounted — hide inactive — so switching tabs stays smooth. */}
        <TabsContent
          value="durations"
          forceMount
          className="mt-4 data-[state=inactive]:hidden"
        >
          <AdminRentalDurations embedded />
        </TabsContent>
        <TabsContent
          value="icons"
          forceMount
          className="mt-4 data-[state=inactive]:hidden"
        >
          <AdminRentalDurationIcons embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRentalSetup;
