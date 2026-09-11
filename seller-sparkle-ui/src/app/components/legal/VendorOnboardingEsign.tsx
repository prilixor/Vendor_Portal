import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { LegalPolicyLinks } from "@/app/components/legal/LegalPolicyLinks";
import { publicLegalApi } from "@/app/services/publicLegalApi";

export function VendorOnboardingEsign({
  signedName,
  onSignedNameChange,
}: {
  signedName: string;
  onSignedNameChange: (value: string) => void;
}) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await publicLegalApi.get("vendor-seller-policy", "vendor_web");
        if (!cancelled) setHtml(detail.contentHtml);
      } catch {
        if (!cancelled) setHtml("");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Vendor / Seller Policy</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Type your full legal name to electronically sign the Vendor / Seller Policy.{" "}
            <Link to="/vendor-seller-policy" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
              Open policy
            </Link>
          </p>
        </div>
      </div>
      {html ? (
        <div
          className="legal-prose max-h-56 overflow-y-auto rounded-lg border bg-background p-3 text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      <LegalPolicyLinks
        surface="vendor_web"
        screen="onboarding"
        className="text-xs text-muted-foreground"
        linkClassName="text-xs"
      />
      <div className="space-y-1.5">
        <Label htmlFor="onboarding-esign-name" className="text-xs">
          Type your full name to sign
        </Label>
        <Input
          id="onboarding-esign-name"
          value={signedName}
          onChange={(event) => onSignedNameChange(event.target.value)}
          placeholder="Full legal name"
          autoComplete="name"
        />
      </div>
    </div>
  );
}
