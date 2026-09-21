import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { legalHref, type LegalWebSurface } from "@/app/helpers/legalSurface";
import { publicLegalApi, type PublicLegalDocumentListItem } from "@/app/services/publicLegalApi";

const LANDING_FALLBACK: PublicLegalDocumentListItem[] = [
  { slug: "terms-of-use", documentType: "terms-of-use", title: "Terms & Conditions", publicPath: "/terms-and-conditions", sortOrder: 1, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: false },
  { slug: "privacy-policy", documentType: "privacy-policy", title: "Privacy Policy", publicPath: "/privacy-policy", sortOrder: 2, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: false },
];

export function LegalFooterStack({
  surface,
  screen,
  fallback = LANDING_FALLBACK,
}: {
  surface: LegalWebSurface;
  screen: string;
  fallback?: PublicLegalDocumentListItem[];
}) {
  const [docs, setDocs] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await publicLegalApi.list(surface, screen);
        if (!cancelled && list.length > 0) {
          setDocs([...list].sort((a, b) => a.sortOrder - b.sortOrder));
        }
      } catch {
        if (!cancelled) setDocs(fallback);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface, screen, fallback]);

  return (
    <>
      {docs.map((doc) => (
        <Link key={doc.slug} to={legalHref(doc)}>
          {doc.title}
        </Link>
      ))}
    </>
  );
}
