import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { legalHref, type LegalWebSurface } from "@/app/helpers/legalSurface";
import { publicLegalApi, type PublicLegalDocumentListItem } from "@/app/services/publicLegalApi";
import { cn } from "@/app/helpers/utils";

export function LegalPolicyLinks({
  surface,
  screen,
  className,
  linkClassName,
  fallback,
}: {
  surface: LegalWebSurface;
  screen: string;
  className?: string;
  linkClassName?: string;
  fallback?: PublicLegalDocumentListItem[];
}) {
  const [docs, setDocs] = useState<PublicLegalDocumentListItem[]>(fallback ?? []);

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

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {docs.map((doc, index) => (
        <span key={doc.slug} className="inline-flex items-center gap-2">
          {index > 0 ? <span className="text-muted-foreground/50">•</span> : null}
          <Link
            to={legalHref(doc)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("transition-colors hover:text-primary hover:no-underline", linkClassName)}
          >
            {doc.title}
          </Link>
        </span>
      ))}
    </div>
  );
}
