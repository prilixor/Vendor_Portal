import {

  LayoutDashboard,

  ClipboardCheck,

  MapPin,

  Clock,

  CalendarDays,

  Package,

  Boxes,
  ClipboardList,
  ShoppingBag,
  TimerReset,

  Bell,

  Settings,
  MessageSquare,
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

      { label: "Service Areas", to: "/vendor/service-areas", icon: MapPin },
      // Temporarily disabled
      // { label: "Working Hours", to: "/vendor/working-hours", icon: Clock },
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

    title: "Orders",

    items: [

      { label: "Order Requests", to: "/vendor/order-requests", icon: ClipboardList },
      { label: "Orders", to: "/vendor/orders", icon: ShoppingBag },
      { label: "Expirations", to: "/vendor/expirations", icon: TimerReset },

    ],

  },

  {

    title: "Account",

    items: [
      { label: "Notifications", to: "/vendor/notifications", icon: Bell },
      { label: "Chats", to: "/vendor/chats", icon: MessageSquare },
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

export const getVendorRoute = (notificationType?: string, title?: string): string | null => {
  const type = notificationType?.trim().toLowerCase() ?? "";
  
  if (type === "dispatch_offer" || type === "new_order" || type.includes("order_request")) {
    return "/vendor/order-requests";
  }
  
  if (type === "order_confirmed" || type === "order_status_updated" || type.startsWith("order_")) {
    return "/vendor/orders";
  }
  
  if (type.startsWith("listing_") || type.includes("product")) {
    return "/vendor/products";
  }
  
  if (type.startsWith("stock_") || type === "low_stock" || type === "out_of_stock") {
    return "/vendor/inventory";
  }
  
  if (type.startsWith("document_")) {
    return "/vendor/onboarding?tab=docs";
  }
  
  if (type.startsWith("bank_")) {
    return "/vendor/onboarding?tab=bank";
  }

  // Handle older extension/buyout notifications that used 'vendor_' prefix
  if (type === "vendor_extension_requested" || type === "vendor_buyout_requested") {
    return "/vendor/orders";
  }

  if (type.startsWith("vendor_")) {
    return "/vendor/onboarding?tab=profile";
  }
  
  // Fallback to title matching
  const t = title?.toLowerCase() ?? "";
  if (t.includes("order request") || t.includes("dispatch offer")) {
    return "/vendor/order-requests";
  }
  if (t.includes("order") || t.includes("rental")) {
    return "/vendor/orders";
  }
  if (t.includes("listing") || t.includes("product")) {
    return "/vendor/products";
  }
  if (t.includes("stock") || t.includes("inventory")) {
    return "/vendor/inventory";
  }
  if (t.includes("document") || t.includes("docs") || t.includes("verification") || t.includes("approved")) {
    return "/vendor/onboarding?tab=docs";
  }
  if (t.includes("bank")) {
    return "/vendor/onboarding?tab=bank";
  }
  if (t.includes("profile")) {
    return "/vendor/onboarding?tab=profile";
  }
  
  return null;
};



