import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Package,
  MapPin,
  Bell,
  LifeBuoy,
  Settings,
  Clock3,
} from "lucide-react";
import type { NavSection } from "@/app/helpers/navigation";

/** Guest "Browse catalog" — shop only; account/order APIs require sign-in. */
export const guestCustomerNav: NavSection[] = [
  {
    title: "Shop",
    items: [
      { label: "Browse", to: "/customer/browse", icon: Store },
      { label: "Cart", to: "/customer/cart", icon: ShoppingCart },
    ],
  },
];

/** Mirrors the Lovable / my-rentals-hub customer shell sections. */
export const customerNav: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", to: "/customer/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Shop",
    items: [
      { label: "Browse", to: "/customer/browse", icon: Store },
    ],
  },
  {
    title: "Orders",
    items: [
      { label: "Cart", to: "/customer/cart", icon: ShoppingCart },
      { label: "Orders", to: "/customer/orders", icon: Package },
      { label: "Expirations", to: "/customer/expirations", icon: Clock3 },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Addresses", to: "/customer/addresses", icon: MapPin },
      { label: "Notifications", to: "/customer/notifications", icon: Bell },
      { label: "Support", to: "/customer/support", icon: LifeBuoy },
      { label: "Settings", to: "/customer/settings", icon: Settings },
    ],
  },
];
