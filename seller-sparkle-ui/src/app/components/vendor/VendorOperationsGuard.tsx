import { useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Link } from "react-router-dom";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";
import { isVendorOperationsPath } from "@/app/helpers/vendorVerification";

interface VendorOperationsGuardProps {
  children: React.ReactNode;
}

export function VendorOperationsGuard({ children }: VendorOperationsGuardProps) {
  const location = useLocation();
  const { isReady, operationsBlocked, onboardingHref, bannerVariant } = useVendorVerification();

  if (!isReady || !operationsBlocked || !isVendorOperationsPath(location.pathname)) {
    return <>{children}</>;
  }

  const title =
    bannerVariant === "missing_docs"
      ? "Upload required documents to unlock this section"
      : bannerVariant === "rejected"
        ? "Fix rejected verification items to continue"
        : "Available after account approval";

  const description =
    bannerVariant === "missing_docs"
      ? "Products, inventory, and orders stay locked until all five KYC documents are uploaded and approved."
      : bannerVariant === "rejected"
        ? "One or more verification items were rejected. Update them in onboarding to restore access."
        : "This section unlocks once your vendor application is approved.";

  return (
    <div className="relative min-h-[420px]">
      <div className="pointer-events-none select-none opacity-35 blur-[1px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-background/55 px-4 pt-16 sm:pt-24">
        <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <Button asChild className="mt-5 bg-gradient-primary shadow-glow">
            <Link to={onboardingHref}>Go to onboarding</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
