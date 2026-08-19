import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Building2,
  Package,
  MessageSquare,
  ShoppingBag,
  TimerReset,
  Bell,
  FlaskConical,
  Shield,
  UserRound,
  Settings,
  Stethoscope,
  CalendarRange,
  Globe,
  FileText,
  Layers,
  HelpCircle,
  PhoneCall,
  Wrench,
} from "lucide-react";
import type { NavSection } from "@/app/helpers/navigation";

export const ADMIN_PERMISSIONS = {
  dashboardView: "dashboard.view",
  notificationsView: "notifications.view",
  ordersView: "orders.view",
  ordersManage: "orders.manage",
  vendorsView: "vendors.view",
  vendorsVerify: "vendors.verify",
  vendorsManage: "vendors.manage",
  vendorsImpersonate: "vendors.impersonate",
  catalogManage: "catalog.manage",
  adminsManage: "admins.manage",
  rolesManage: "roles.manage",
  customersView: "customers.view",
  customersPlaceOrder: "customers.place_order",
  customersImpersonate: "customers.impersonate",
  auditView: "audit.view",
  supportManage: "support.manage",
} as const;

type AdminNavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission?: string;
};

const adminNavBase: { title: string; items: AdminNavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, permission: ADMIN_PERMISSIONS.dashboardView },
      { label: "Notifications", to: "/admin/notifications", icon: Bell, permission: ADMIN_PERMISSIONS.notificationsView },
      { label: "Orders", to: "/admin/orders", icon: ShoppingBag, permission: ADMIN_PERMISSIONS.ordersView },
      { label: "Expirations", to: "/admin/expirations", icon: TimerReset, permission: ADMIN_PERMISSIONS.ordersView },
      { label: "Customers", to: "/admin/customers", icon: UserRound, permission: ADMIN_PERMISSIONS.customersView },
    ],
  },
  {
    title: "Vendors",
    items: [
      { label: "Verification", to: "/admin/verification", icon: ShieldCheck, permission: ADMIN_PERMISSIONS.vendorsVerify },
      { label: "All Vendors", to: "/admin/vendors", icon: Building2, permission: ADMIN_PERMISSIONS.vendorsView },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products Management", to: "/admin/products", icon: Package, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Rental Setup", to: "/admin/rental-setup", icon: CalendarRange, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Chemicals Management", to: "/admin/chemicals", icon: FlaskConical, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Doctor References", to: "/admin/doctors", icon: Stethoscope, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Hospitals", to: "/admin/hospitals", icon: Building2, permission: ADMIN_PERMISSIONS.catalogManage },
    ],
  },
  {
    title: "Portal Content Management",
    items: [
      { label: "Home Content", to: "/admin/website-content/home", icon: Globe, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "About Content", to: "/admin/website-content/about", icon: FileText, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Services Content", to: "/admin/website-content/services", icon: Stethoscope, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "How It Works", to: "/admin/website-content/how-it-works", icon: Wrench, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Rent or Buy Content", to: "/admin/website-content/rent-or-buy", icon: Layers, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "FAQ Management", to: "/admin/website-content/faq", icon: HelpCircle, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Contact Details", to: "/admin/website-content/contact", icon: PhoneCall, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Portal Settings", to: "/admin/website-content/settings", icon: Settings, permission: ADMIN_PERMISSIONS.catalogManage },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Admin Users", to: "/admin/admins", icon: Users, permission: ADMIN_PERMISSIONS.adminsManage },
      { label: "Roles & Permissions", to: "/admin/roles", icon: Shield, permission: ADMIN_PERMISSIONS.rolesManage },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText, permission: ADMIN_PERMISSIONS.auditView },
      { label: "Support", to: "/admin/support", icon: MessageSquare, permission: ADMIN_PERMISSIONS.supportManage },
      { label: "Customer Chats", to: "/admin/customer-chats", icon: MessageSquare, permission: ADMIN_PERMISSIONS.supportManage },
      // Available to every signed-in admin (no extra permission)
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

export const adminNav: NavSection[] = adminNavBase.map((section) => ({
  title: section.title,
  items: section.items.map(({ label, to, icon }) => ({ label, to, icon })),
}));

export const getAdminNav = (
  unreadCount: number,
  permissions?: string[] | null,
  customerChatUnread = 0,
  vendorSupportUnread = 0
): NavSection[] => {
  const perms = permissions ?? null;
  const allow = (permission?: string) => {
    if (!permission) return true;
    // Until RBAC migrated / permissions missing, show all for admins
    if (!perms || perms.length === 0) return true;
    return perms.includes(permission);
  };

  return adminNavBase
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter((item) => allow(item.permission))
        .map((item) => {
          if (item.label === "Notifications" && unreadCount > 0) {
            return { label: item.label, to: item.to, icon: item.icon, badge: unreadCount.toString() };
          }
          if (item.label === "Support" && vendorSupportUnread > 0) {
            return {
              label: item.label,
              to: item.to,
              icon: item.icon,
              badge: vendorSupportUnread > 99 ? "99+" : vendorSupportUnread.toString(),
            };
          }
          if (item.label === "Customer Chats" && customerChatUnread > 0) {
            return {
              label: item.label,
              to: item.to,
              icon: item.icon,
              badge: customerChatUnread > 99 ? "99+" : customerChatUnread.toString(),
            };
          }
          return { label: item.label, to: item.to, icon: item.icon };
        }),
    }))
    .filter((section) => section.items.length > 0);
};
