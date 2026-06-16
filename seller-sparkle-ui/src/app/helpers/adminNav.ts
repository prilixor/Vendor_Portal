import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Building2,
  Package,
  MessageSquare,
  ShoppingBag,
  Bell,
} from "lucide-react";
import type { NavSection } from "@/app/helpers/navigation";

export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Orders", to: "/admin/orders", icon: ShoppingBag },
    ],
  },
  {
    title: "Vendors",
    items: [
      { label: "Verification", to: "/admin/verification", icon: ShieldCheck },
      { label: "All Vendors", to: "/admin/vendors", icon: Building2 },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products Management", to: "/admin/products", icon: Package },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Admin Users", to: "/admin/admins", icon: Users },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText },
      { label: "Support", to: "/admin/support", icon: MessageSquare },
    ],
  },
];

export const getAdminNav = (unreadCount: number): NavSection[] => {
  return adminNav.map(section => ({
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
