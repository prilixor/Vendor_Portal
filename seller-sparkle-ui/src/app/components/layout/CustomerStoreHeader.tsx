import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  ShoppingCart,
  Sun,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/guards/AuthContext";
import { useCart } from "@/app/contexts/CartContext";
import { customerApi } from "@/app/services/customerApi";
import { customerNav, guestCustomerNav } from "@/app/helpers/navigation";
import { getVendorPortalHref } from "@/app/helpers/portalHost";
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
import { BrandMark } from "@/app/components/shared/BrandMark";

function flattenNavItems(signedIn: boolean) {
  const sections = signedIn ? customerNav : guestCustomerNav;
  return sections.flatMap((s) => s.items);
}

export function CustomerStoreHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const vendorPortalHref = getVendorPortalHref("/login");
  const signedIn = user?.role === "customer";
  const navItems = useMemo(() => flattenNavItems(!!signedIn), [signedIn]);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  const { lines } = useCart();
  const cartCount = useMemo(() => lines.reduce((acc, l) => acc + l.quantity, 0), [lines]);

  const { data: customerNotifications = [] } = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => customerApi.getNotifications({ quiet: true }),
    enabled: !!signedIn,
    refetchInterval: 30000,
  });
  const unreadCustomerCount = useMemo(
    () => customerNotifications.filter((n) => !n.readAt).length,
    [customerNotifications],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-14 min-w-0 max-w-[1400px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        <Link to="/customer/shop" className="flex shrink-0 items-center" aria-label="BlinksMed shop">
          {/* Full lockup already includes BLINKSMED + Buy | Rent | Care */}
          <BrandMark size="lg" className="h-10 w-10 sm:h-14 sm:w-14" />
        </Link>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDark((v) => !v)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Sell/Vendor only for guests — hidden when customer is logged in */}
          {!signedIn && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <a href={vendorPortalHref}>Sell / Vendor</a>
            </Button>
          )}

          {signedIn && (
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
          )}

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

          {signedIn ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-muted transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-[11px] text-muted-foreground leading-tight">Account</p>
                    <p className="text-xs font-semibold leading-tight max-w-[120px] truncate">
                      {user?.name}
                    </p>
                  </div>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="z-[80] max-h-[min(24rem,calc(100dvh-5rem))] w-60 overflow-y-auto"
              >
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navItems.map((item) => (
                  <DropdownMenuItem key={item.to} onClick={() => navigate(item.to)}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                    {item.label === "Cart" && cartCount > 0 ? (
                      <span className="ml-auto text-xs text-muted-foreground">{cartCount}</span>
                    ) : null}
                    {item.label === "Notifications" && unreadCustomerCount > 0 ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {unreadCustomerCount}
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate("/customer/login");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" asChild>
                <Link to="/customer/login">Sign in</Link>
              </Button>
              <Button
                size="sm"
                className="hidden bg-gradient-primary hover:opacity-95 shadow-glow sm:inline-flex"
                asChild
              >
                <Link to="/customer/register">Register</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
