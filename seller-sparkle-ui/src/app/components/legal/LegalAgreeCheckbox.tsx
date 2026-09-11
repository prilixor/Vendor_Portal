import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { legalHref, type LegalWebSurface } from "@/app/helpers/legalSurface";
import { publicLegalApi, type PublicLegalDocumentListItem } from "@/app/services/publicLegalApi";

const TERMS: PublicLegalDocumentListItem = {
  slug: "terms-of-use", documentType: "terms-of-use", title: "Terms of Use",
  publicPath: "/terms-and-conditions", sortOrder: 1, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};
const PRIVACY: PublicLegalDocumentListItem = {
  slug: "privacy-policy", documentType: "privacy-policy", title: "Privacy Policy",
  publicPath: "/privacy-policy", sortOrder: 2, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};
const SELLER: PublicLegalDocumentListItem = {
  slug: "vendor-seller-policy", documentType: "vendor-seller-policy", title: "Vendor / Seller Policy",
  publicPath: "/vendor-seller-policy", sortOrder: 3, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};
const RENTAL: PublicLegalDocumentListItem = {
  slug: "rental-and-purchase-policy", documentType: "rental-and-purchase-policy", title: "Rental & Purchase Policy",
  publicPath: "/rental-and-purchase-policy", sortOrder: 3, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};
const CANCEL: PublicLegalDocumentListItem = {
  slug: "cancellation-refund-policy", documentType: "cancellation-refund-policy", title: "Cancellation & Refund Policy",
  publicPath: "/cancellation-refund-policy", sortOrder: 4, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};
const SHIPPING: PublicLegalDocumentListItem = {
  slug: "shipping-delivery-policy", documentType: "shipping-delivery-policy", title: "Shipping & Delivery Policy",
  publicPath: "/shipping-delivery-policy", sortOrder: 5, versionNumber: 1, effectiveFrom: "", lastUpdated: "", isRequiredToProceed: true,
};

function fallbacks(surface: LegalWebSurface, screen: string): PublicLegalDocumentListItem[] {
  if (screen === "checkout") return surface === "customer_web" ? [RENTAL, CANCEL, SHIPPING] : [];
  if (screen === "prescription") return surface === "customer_web" ? [PRIVACY] : [];
  if (screen === "reconsent") {
    return surface === "vendor_web" ? [TERMS, PRIVACY, SELLER] : [TERMS, PRIVACY];
  }
  if (screen === "register") {
    return surface === "vendor_web" ? [TERMS, PRIVACY, SELLER] : [TERMS, PRIVACY];
  }
  return [];
}

function pageSurface(slug: string) {
  return slug === "vendor-seller-policy" ? "vendor_web" : undefined;
}

function joinTitles(docs: PublicLegalDocumentListItem[]) {
  return docs.map((doc, index) => {
    const href = legalHref(doc);
    const surface = pageSurface(doc.slug);
    const link = (
      <Link
        key={doc.slug}
        to={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-medium hover:underline"
        onMouseEnter={() => publicLegalApi.prefetch(doc.slug, surface)}
        onFocus={() => publicLegalApi.prefetch(doc.slug, surface)}
      >
        {doc.title}
      </Link>
    );
    if (index === 0) return <span key={doc.slug}>{link}</span>;
    if (index === docs.length - 1) return <span key={doc.slug}>{" and "}{link}</span>;
    return <span key={doc.slug}>{", "}{link}</span>;
  });
}

export function LegalAgreeCheckbox({
  surface,
  screen,
  agreed,
  onAgreedChange,
  prefix,
  id = "legal-agree",
}: {
  surface: LegalWebSurface;
  screen: string;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  prefix: string;
  id?: string;
}) {
  const [docs, setDocs] = useState<PublicLegalDocumentListItem[]>(fallbacks(surface, screen));

  useEffect(() => {
    let cancelled = false;
    for (const doc of fallbacks(surface, screen)) {
      publicLegalApi.prefetch(doc.slug, pageSurface(doc.slug));
    }
    const load = async () => {
      try {
        const list = await publicLegalApi.list(surface, screen);
        const required = list.filter((item) => item.isRequiredToProceed).sort((a, b) => a.sortOrder - b.sortOrder);
        if (!cancelled && required.length > 0) {
          setDocs(required);
          for (const doc of required) {
            publicLegalApi.prefetch(doc.slug, pageSurface(doc.slug));
          }
        }
      } catch {
        if (!cancelled) setDocs(fallbacks(surface, screen));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface, screen]);

  if (docs.length === 0) return null;

  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id={id}
        checked={agreed}
        onCheckedChange={(checked) => onAgreedChange(checked === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal leading-normal text-muted-foreground">
        {prefix} {joinTitles(docs)}.
      </Label>
    </div>
  );
}
