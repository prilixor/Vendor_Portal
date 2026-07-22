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
  FlaskConical,
  Shield,
  UserRound,
  Settings,
  Stethoscope,
  Building2,
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
      { label: "Chemicals Management", to: "/admin/chemicals", icon: FlaskConical, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Doctor References", to: "/admin/doctors", icon: Stethoscope, permission: ADMIN_PERMISSIONS.catalogManage },
      { label: "Hospitals", to: "/admin/hospitals", icon: Building2, permission: ADMIN_PERMISSIONS.catalogManage },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Admin Users", to: "/admin/admins", icon: Users, permission: ADMIN_PERMISSIONS.adminsManage },
      { label: "Roles & Permissions", to: "/admin/roles", icon: Shield, permission: ADMIN_PERMISSIONS.rolesManage },
      { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText, permission: ADMIN_PERMISSIONS.auditView },
      { label: "Support", to: "/admin/support", icon: MessageSquare, permission: ADMIN_PERMISSIONS.supportManage },
      // Available to every signed-in admin (no extra permission)
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

export const adminNav: NavSection[] = adminNavBase.map((section) => ({
  title: section.title,
  items: section.items.map(({ label, to, icon }) => ({ label, to, icon })),
}));

export const getAdminNav = (unreadCount: number, permissions?: string[] | null): NavSection[] => {
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
          return { label: item.label, to: item.to, icon: item.icon };
        }),
    }))
    .filter((section) => section.items.length > 0);
};
