import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { BackLink } from "@/app/components/shared/BackLink";
import { BrandMark } from "@/app/components/shared/BrandMark";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { publicLegalApi, type PublicLegalDocumentDetail } from "@/app/services/publicLegalApi";
import { legalHref, resolveLegalSurface } from "@/app/helpers/legalSurface";

function formatStamp(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "dd MMM yyyy");
}

function pageSurface(slug: string) {
  return resolveLegalSurface(slug === "vendor-seller-policy" ? "vendor" : undefined);
}

export default function LegalDocumentPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const cached = publicLegalApi.peek(slug, pageSurface(slug));
  const [loading, setLoading] = useState(!cached);
  const [doc, setDoc] = useState<PublicLegalDocumentDetail | null>(cached);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const surface = pageSurface(slug);
    const warm = publicLegalApi.peek(slug, surface);
    if (warm) {
      setDoc(warm);
      setLoading(false);
      setMissing(false);
    } else {
      setLoading(true);
      setMissing(false);
    }

    const load = async () => {
      try {
        const detail = warm
          ? await publicLegalApi.refresh(slug, surface)
          : await publicLegalApi.get(slug, surface);
        if (!cancelled) {
          setDoc(detail);
          setMissing(false);
        }
      } catch {
        if (!cancelled && !warm) {
          setDoc(null);
          setMissing(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleBack = () => {
    if (window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const effective = formatStamp(doc?.effectiveFrom);
  const updated = formatStamp(doc?.lastUpdated);

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <BackLink onClick={handleBack} label="Back" />
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity" aria-label="BlinksMed home">
              <BrandMark size="sm" />
            </Link>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Legal documentation
          </span>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-12">
        <PageContentGate loading={loading}>
          {missing || !doc ? (
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold tracking-tight">Policy not available</h1>
              <p className="text-sm text-muted-foreground">
                This policy is not published for this portal, or it is hidden for your account type.
              </p>
              <Link to="/" className="text-sm font-medium text-primary hover:underline">
                Back to home
              </Link>
            </div>
          ) : (
            <article className="min-w-0">
              <h1 className="text-pretty text-3xl font-extrabold tracking-tight text-foreground lg:text-4xl">
                {doc.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {effective ? `Effective ${effective}` : null}
                {effective && updated ? " · " : null}
                {updated ? `Last updated ${updated}` : null}
                {doc.versionNumber ? ` · Version ${doc.versionNumber}` : null}
              </p>
              <div
                className="legal-prose mt-8 min-w-0 max-w-full"
                dangerouslySetInnerHTML={{ __html: doc.contentHtml }}
              />
              <p className="mt-10 text-xs text-muted-foreground">
                Related:{" "}
                <Link to={legalHref({ slug: "terms-of-use", publicPath: "/terms-and-conditions" })} className="text-primary hover:underline">
                  Terms of Use
                </Link>
                {" · "}
                <Link to={legalHref({ slug: "privacy-policy", publicPath: "/privacy-policy" })} className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </article>
          )}
        </PageContentGate>
      </main>
    </div>
  );
}
