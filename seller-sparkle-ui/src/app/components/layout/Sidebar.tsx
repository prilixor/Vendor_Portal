import { useState, useMemo } from "react";
import { NavLink } from "@/app/components/shared/NavLink";
import { useLocation, Link } from "react-router-dom";
import { ChevronLeft, Lock, X } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { NavSection } from "@/app/helpers/navigation";
import { Badge } from "@/app/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useAuth } from "@/app/guards/AuthContext";
import { useCart } from "@/app/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";
import { useNotificationContext } from "@/app/contexts/NotificationContext";
import { useSupportChat } from "@/app/contexts/SupportChatContext";
import { BrandMark } from "@/app/components/shared/BrandMark";

interface SidebarProps {
  variant?: "vendor" | "admin" | "customer";
  sections: NavSection[];
  brandLabel: string;
  /** When set, replaces the default "Vendor Portal" primary sidebar title. */
  brandHeading?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ variant = "vendor", sections, brandLabel, brandHeading, isOpen, onClose }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  // 1. Get Cart Count (for Customer variant)
  const { lines } = useCart();
  const cartCount = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.quantity, 0);
  }, [lines]);

  // 2. Get Unread Customer Notifications (for Customer variant)
  const { data: customerNotifications = [] } = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => customerApi.getNotifications({ quiet: true }),
    enabled: variant === "customer" && !!user,
    refetchInterval: 30000, // refresh every 30 seconds
  });
  const unreadCustomerCount = useMemo(() => {
    return customerNotifications.filter((n) => !n.readAt).length;
  }, [customerNotifications]);

  // 3. Get Unread Vendor Notifications (for Vendor variant)
  const { unreadCount: unreadVendorCount } = useNotificationContext();

  // 4. Support chat trigger (for Vendor in-portal support)
  const { openSupportPanel } = useSupportChat();

  // Inject badges dynamically based on the current navigation item
  const dynamicSections = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        let badgeValue: string | undefined = undefined;

        if (variant === "customer") {
          if (item.label === "Cart" && cartCount > 0) {
            badgeValue = cartCount.toString();
          } else if (item.label === "Notifications" && unreadCustomerCount > 0) {
            badgeValue = unreadCustomerCount.toString();
          }
        } else if (variant === "vendor") {
          if (item.label === "Notifications" && unreadVendorCount > 0) {
            badgeValue = unreadVendorCount.toString();
          }
        }

        return {
          ...item,
          badge: badgeValue || item.badge,
        };
      }),
    }));
  }, [sections, variant, cartCount, unreadCustomerCount, unreadVendorCount]);

  const isActive = (to: string) =>
    to === location.pathname ||
    (to !== "/vendor" &&
      to !== "/admin" &&
      to !== "/customer/shop" &&
      to !== "/customer/dashboard" &&
      location.pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar pointer-events-auto transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "lg:w-[72px]" : "lg:w-[260px] w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="absolute right-3 top-4 z-50 flex h-8 w-8 items-center justify-center rounded-full border-0 bg-background text-muted-foreground shadow-md hover:bg-muted lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <BrandMark />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold leading-tight">{brandHeading ?? "Vendor Portal"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{brandLabel}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {dynamicSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.to);
                const disabled = !!item.disabled;

                const linkContent = (
                  <>
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active && !disabled && "text-primary",
                        disabled && "text-muted-foreground/70",
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {disabled && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />}
                        {item.badge && (
                          <Badge variant="secondary" className="h-5 bg-primary/10 px-1.5 text-[10px] text-primary">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </>
                );

                const className = cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/70"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center",
                );

                return (
                  <li key={item.to}>
                    {disabled ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={className}
                            aria-disabled="true"
                            title={item.disabledReason}
                          >
                            {linkContent}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          {item.disabledReason ?? "This section is currently unavailable."}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <NavLink
                        to={item.to}
                        end={
                          item.to === "/vendor" ||
                          item.to === "/admin" ||
                          item.to === "/customer/dashboard" ||
                          item.to === "/customer/shop"
                        }
                        onClick={() => onClose?.()}
                        className={className}
                        activeClassName="!bg-sidebar-accent !text-sidebar-accent-foreground"
                      >
                        {linkContent}
                      </NavLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer hint */}
      {!collapsed && (
        <div className="m-3 hidden rounded-xl bg-gradient-soft p-3 text-xs lg:block">
          <p className="font-semibold">Need help?</p>
          <p className="mt-0.5 text-muted-foreground">
            {variant === "vendor" ? (
              <>
                Check the docs or{" "}
                <button
                  type="button"
                  onClick={() => openSupportPanel()}
                  className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  chat with support
                </button>
                .
              </>
            ) : (
              "Check the docs or chat with support."
            )}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline transition-colors">Privacy</Link>
            <span>•</span>
            {variant === "vendor" ? (
              <button
                type="button"
                onClick={() => openSupportPanel()}
                className="hover:text-primary hover:underline transition-colors cursor-pointer"
              >
                Contact
              </button>
            ) : variant === "customer" ? (
              <Link to="/customer/support" className="hover:text-primary hover:underline transition-colors">Contact</Link>
            ) : (
              <Link to="/admin/support" className="hover:text-primary hover:underline transition-colors">Contact</Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};


