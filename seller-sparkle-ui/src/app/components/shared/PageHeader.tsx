import { ReactNode } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

export const PageHeader = ({ title, description, actions, breadcrumbs }: PageHeaderProps) => {
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
    <div className="mb-6 animate-fade-in">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
