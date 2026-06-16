import { useNavigate, Link } from "react-router-dom";
import { Bell, LogOut, Sun, Moon, ChevronDown, ShoppingCart } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/app/guards/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useNotificationContext } from "@/app/contexts/NotificationContext";
import { useCart } from "@/app/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { customerApi } from "@/app/services/customerApi";
import { adminApi } from "@/app/services/adminApi";

interface TopBarProps {
  onMenuClick?: () => void;
  variant?: "vendor" | "admin" | "customer";
}

export const TopBar = ({ onMenuClick, variant = "vendor" }: TopBarProps) => {
  const { unreadCount } = useNotificationContext();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark";
  });

  // 1. Get Cart Count (for Customer top bar)
  const { lines } = useCart();
  const cartCount = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.quantity, 0);
  }, [lines]);

  // 2. Get Unread Customer Notifications (for Customer top bar)
  const { data: customerNotifications = [] } = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => customerApi.getNotifications(),
    enabled: variant === "customer" && !!user,
    refetchInterval: 30000, // every 30 seconds
  });
  const unreadCustomerCount = useMemo(() => {
    return customerNotifications.filter((n) => !n.readAt).length;
  }, [customerNotifications]);

  const { data: adminOrders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => adminApi.getAdminOrders(),
    enabled: variant === "admin" && !!user,
    refetchInterval: 30000, // every 30 seconds
  });

  const { data: adminVendors = [] } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => adminApi.getVendors(),
    enabled: variant === "admin" && !!user,
    refetchInterval: 30000, // every 30 seconds
  });

  const unreadAdminCount = useMemo(() => {
    const criticalOrders = adminOrders.filter((o) => {
      const s = o.status.toLowerCase().replace(/_/g, " ");
      return s.includes("dispatch failed") || s.includes("cancelled");
    }).length;
    const pendingVendors = adminVendors.filter((v) => v.accountStatus === "pending").length;
    return criticalOrders + pendingVendors;
  }, [adminOrders, adminVendors]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  const loginHref =
    variant === "admin" ? "/admin/login" : variant === "customer" ? "/customer/login" : "/login";

  const showVendorBell = variant === "vendor" && user?.role === "vendor";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {onMenuClick && (
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden" aria-label="Menu">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {variant === "admin" && user && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/notifications")}
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="h-4 w-4" />
            {unreadAdminCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-glow animate-pulse">
                {unreadAdminCount > 99 ? "99+" : unreadAdminCount}
              </span>
            )}
          </Button>
        )}

        {variant === "customer" && user && (
          <>
            {/* Customer Notifications Icon with Badge */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/customer/notifications")}
              aria-label="Notifications"
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCustomerCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCustomerCount > 99 ? "99+" : unreadCustomerCount}
                </span>
              )}
            </Button>

            {/* Customer Cart Icon with Badge */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/customer/cart")}
              aria-label="Shopping Cart"
              className="relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-glow">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          </>
        )}

        {variant === "customer" && !user && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/customer/login">Sign in</Link>
            </Button>
            <Button size="sm" className="bg-gradient-primary hover:opacity-95 shadow-glow" asChild>
              <Link to="/customer/register">Register</Link>
            </Button>
          </>
        )}

        {showVendorBell && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/vendor/notifications")}
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        )}

        {!(variant === "customer" && !user) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold leading-tight">{user?.name}</p>
                  <p className="text-[11px] capitalize text-muted-foreground leading-tight">{user?.role}</p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  logout();
                  navigate(loginHref);
                }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};
