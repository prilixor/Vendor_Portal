import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Scale } from "lucide-react";
import { legalHref, type LegalWebSurface } from "@/app/helpers/legalSurface";
import { publicLegalApi, type PublicLegalDocumentListItem } from "@/app/services/publicLegalApi";
import { cn } from "@/app/helpers/utils";
import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";

type LegalPolicyLinksLayout = "inline" | "quiet" | "menu";

/** @deprecated mapped to quiet / menu */
type LegacyLayout = "list" | "stack" | "rows" | "grid";

/** Brand primary on every surface — matches LegalAgreeCheckbox and mobile `colors.accent`. */
const policyLinkClass =
  "!text-primary font-medium underline-offset-2 transition-colors hover:!text-primary/80 hover:underline";

function PolicyQuiet({
  docs,
  className,
  linkClassName,
}: {
  docs: PublicLegalDocumentListItem[];
  className?: string;
  linkClassName?: string;
}) {
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {docs.map((doc, index) => (
        <li key={doc.slug} className="min-w-0">
          <Link
            to={legalHref(doc)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex items-center justify-between gap-3 py-2.5 text-sm no-underline",
              policyLinkClass,
              index < docs.length - 1 && "border-b border-border/60",
              linkClassName,
            )}
          >
            <span className="min-w-0 truncate font-medium tracking-tight">{doc.title}</span>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PolicyMenuList({
  docs,
  className,
  linkClassName,
}: {
  docs: PublicLegalDocumentListItem[];
  className?: string;
  linkClassName?: string;
}) {
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {docs.map((doc) => (
        <li key={doc.slug}>
          <Link
            to={legalHref(doc)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-2 py-2 text-[13px] no-underline hover:bg-muted",
              policyLinkClass,
              linkClassName,
            )}
          >
            <span className="min-w-0 truncate">{doc.title}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LegalPolicyLinks({
  surface,
  screen,
  className,
  linkClassName,
  fallback,
  layout = "inline",
  menuLabel = "Legal",
}: {
  surface: LegalWebSurface;
  screen: string;
  className?: string;
  linkClassName?: string;
  fallback?: PublicLegalDocumentListItem[];
  /**
   * inline — checkout / product one-line
   * quiet — settings (typography list, senior product UI)
   * menu — sidebar popover
   */
  layout?: LegalPolicyLinksLayout | LegacyLayout;
  menuLabel?: string;
}) {
  const [docs, setDocs] = useState<PublicLegalDocumentListItem[]>(fallback ?? []);
  const resolvedLayout: LegalPolicyLinksLayout =
    layout === "list" || layout === "rows" || layout === "grid"
      ? "quiet"
      : layout === "stack"
        ? "menu"
        : layout;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await publicLegalApi.list(surface, screen);
        const visible = list.filter((item) => item.publicPath || item.slug).sort((a, b) => a.sortOrder - b.sortOrder);
        if (!cancelled && visible.length > 0) setDocs(visible);
      } catch {
        if (!cancelled && fallback) setDocs(fallback);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface, screen, fallback]);

  if (docs.length === 0) return null;

  if (resolvedLayout === "quiet") {
    return <PolicyQuiet docs={docs} className={className} linkClassName={linkClassName} />;
  }

  if (resolvedLayout === "menu") {
    return (
      <div className={cn("min-w-0", className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-auto justify-start gap-1.5 px-0 py-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <Scale className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate underline-offset-2 hover:underline">{menuLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-64 p-2 shadow-md">
            <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Policies
            </p>
            <PolicyMenuList docs={docs} linkClassName={linkClassName} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <nav aria-label="Policies" className={cn("flex flex-wrap items-center gap-x-0 gap-y-1", className)}>
      {docs.map((doc, index) => (
        <span key={doc.slug} className="inline-flex max-w-full items-center whitespace-nowrap">
          {index > 0 ? (
            <span className="mx-1.5 shrink-0 text-muted-foreground/40" aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            to={legalHref(doc)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "max-w-full truncate underline",
              policyLinkClass,
              linkClassName,
            )}
          >
            {doc.title}
          </Link>
        </span>
      ))}
    </nav>
  );
}
