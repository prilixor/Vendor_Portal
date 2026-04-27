import {

  LayoutDashboard,

  ClipboardCheck,

  MapPin,

  Clock,

  CalendarDays,

  Package,

  Boxes,

  Bell,

  Settings,

} from "lucide-react";

import type { NavSection } from "@/app/helpers/navigation";



export const vendorNav: NavSection[] = [

  {

    title: "Overview",

    items: [

      { label: "Dashboard", to: "/vendor", icon: LayoutDashboard },

      { label: "Onboarding", to: "/vendor/onboarding", icon: ClipboardCheck },

    ],

  },

  {

    title: "Operations",

    items: [

      // Temporarily disabled
      // { label: "Service Areas", to: "/vendor/service-areas", icon: MapPin },
      { label: "Working Hours", to: "/vendor/working-hours", icon: Clock },
      // { label: "Availability", to: "/vendor/availability", icon: CalendarDays },

    ],

  },

  {

    title: "Catalog",

    items: [

      { label: "Products", to: "/vendor/products", icon: Package },

      { label: "Inventory", to: "/vendor/inventory", icon: Boxes },

    ],

  },

  {

    title: "Account",

    items: [
      { label: "Notifications", to: "/vendor/notifications", icon: Bell },
      { label: "Settings", to: "/vendor/settings", icon: Settings },

    ],

  },

];

export const getVendorNav = (unreadCount: number): NavSection[] => {
  return vendorNav.map(section => ({
    ...section,
    items: section.items.map(item => {
      if (item.label === "Notifications" && unreadCount > 0) {
        return {
          ...item,
          badge: unreadCount.toString(),
        };
      }
      return item;
    }),
  }));
};



