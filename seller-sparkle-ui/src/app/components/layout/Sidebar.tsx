import { useState } from "react";
import { NavLink } from "@/app/components/shared/NavLink";
import { useLocation } from "react-router-dom";
import { ChevronLeft, Sparkles } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { NavSection } from "@/app/helpers/navigation";
import { Badge } from "@/app/components/ui/badge";

interface SidebarProps {
  sections: NavSection[];
  brandLabel: string;
}

export const Sidebar = ({ sections, brandLabel }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isActive = (to: string) =>
    to === location.pathname || (to !== "/vendor" && to !== "/admin" && location.pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out flex flex-col",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold leading-tight">Vendor Portal</p>
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
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/vendor" || item.to === "/admin"}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center"
                      )}
                      activeClassName="!bg-sidebar-accent !text-sidebar-accent-foreground"
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active && "text-primary"
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="h-5 bg-primary/10 px-1.5 text-[10px] text-primary">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer hint */}
      {!collapsed && (
        <div className="m-3 rounded-xl bg-gradient-soft p-3 text-xs">
          <p className="font-semibold">Need help?</p>
          <p className="mt-0.5 text-muted-foreground">Check the docs or chat with support.</p>
        </div>
      )}
    </aside>
  );
};


