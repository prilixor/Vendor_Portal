import { ReactNode } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  /** When false, breadcrumb row is omitted (e.g. compact settings). Default true. */
  showBreadcrumbs?: boolean;
}

export const PageHeader = ({
  title,
  description,
  actions,
  breadcrumbs,
  showBreadcrumbs = true,
}: PageHeaderProps) => {
  const location = useLocation();
  const auto =
    breadcrumbs ??
    location.pathname
      .split("/")
      .filter(Boolean)
      .map((seg, idx, arr) => ({
        label: seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        href: idx < arr.length - 1 ? "/" + arr.slice(0, idx + 1).join("/") : undefined,
      }));

  return (
    <div className="mb-4 min-w-0 max-w-full overflow-x-clip animate-fade-in sm:mb-6">
      {showBreadcrumbs ? (
      <nav className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:mb-3">
        <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" />
        </Link>
        {auto.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            {crumb.href ? (
              <Link to={crumb.href} className="hover:text-foreground transition-colors">{crumb.label}</Link>
            ) : (
              <span className="text-foreground font-medium">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground max-w-2xl sm:mt-1">{description}</p>}
        </div>
        {actions && <div className="flex min-w-0 flex-nowrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
