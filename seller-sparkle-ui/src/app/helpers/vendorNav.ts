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
      { label: "Settings", to: "/vendor/settings", icon: Settings },

    ],

  },
];

const VENDOR_OPERATIONS_LABELS = new Set([
  "Products",
  "Inventory",
  "Order Requests",
  "Orders",
  "Expirations",
]);

export const getVendorNav = (
  unreadCount: number,
  options?: {
    operationsBlocked?: boolean;
    blockedReason?: string;
    pendingOrderRequestsCount?: number;
  },
): NavSection[] => {
  const operationsBlocked = options?.operationsBlocked ?? false;
  const blockedReason =
    options?.blockedReason ??
    "Complete document verification to unlock catalog and order management.";
  const pendingOrderRequestsCount = options?.pendingOrderRequestsCount ?? 0;

  return vendorNav.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      let nextItem = { ...item };

      if (item.label === "Notifications" && unreadCount > 0) {
        nextItem = {
          ...nextItem,
          badge: unreadCount.toString(),
        };
      }

      if (item.label === "Order Requests" && pendingOrderRequestsCount > 0) {
        nextItem = {
          ...nextItem,
          badge: pendingOrderRequestsCount.toString(),
        };
      }

      if (operationsBlocked && VENDOR_OPERATIONS_LABELS.has(item.label)) {
        nextItem = {
          ...nextItem,
          disabled: true,
          disabledReason: blockedReason,
        };
      }

      return nextItem;
    }),
  }));
};

/** Sentinel — Vendor Notifications opens the Support FAB instead of navigating. */
export const VENDOR_SUPPORT_PANEL_ROUTE = "__support_panel__";

export const getVendorRoute = (notificationType?: string, title?: string): string | null => {
  const type = notificationType?.trim().toLowerCase() ?? "";

  if (
    type === "support_chat_reply" ||
    type.includes("support_chat") ||
    type === "support_reply"
  ) {
    return VENDOR_SUPPORT_PANEL_ROUTE;
  }
  
  if (type === "dispatch_offer" || type === "new_order" || type.includes("order_request")) {
    return "/vendor/order-requests";
  }
  
  if (
    type === "order_confirmed" ||
    type === "order_status_updated" ||
    type === "order_photos_requested" ||
    type.startsWith("order_")
  ) {
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
  if (t.includes("blinksmed support") || t.includes("support replied") || t.includes("support reply")) {
    return VENDOR_SUPPORT_PANEL_ROUTE;
  }
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



