import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/app/helpers/utils";

type BackLinkProps = {
  to?: string;
  label: string;
  className?: string;
  onClick?: () => void;
  compact?: boolean;
};

/** Modern squircle back navigation button with chevron icon, matching website design tokens and dark/light theme. */
export function BackLink({ to, label, className, onClick, compact = false }: BackLinkProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground shadow-sm transition-all duration-200 group-hover:border-primary/40 group-hover:bg-accent group-hover:shadow-md",
          compact ? "h-7 w-7 rounded-lg" : "h-9 w-9",
        )}
      >
        <ChevronLeft
          className={cn(
            "transition-transform duration-200 group-hover:-translate-x-0.5",
            compact ? "h-4 w-4" : "h-5 w-5",
          )}
          strokeWidth={2.2}
        />
      </span>
      <span className="tracking-tight">{label}</span>
    </>
  );

  const classes = cn(
    "group inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground active:scale-[0.98]",
    className,
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
