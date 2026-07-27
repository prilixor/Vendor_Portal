import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Clock, FileWarning, X } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { Button } from "@/app/components/ui/button";
import { useVendorVerification } from "@/app/contexts/VendorVerificationContext";

interface VendorVerificationBannerProps {
  className?: string;
}

export function VendorVerificationBanner({ className }: VendorVerificationBannerProps) {
  const {
    bannerVariant,
    missingDocuments,
    rejectedDocuments,
    pendingDocuments,
    bankStatus,
    onboardingHref,
    approvedDocumentCount,
    checklist,
  } = useVendorVerification();
  const [dismissed, setDismissed] = useState(false);

  if (!bannerVariant || dismissed) return null;

  const canDismiss = bannerVariant === "pending_review";
  const totalRequired = checklist.length;

  const titleByVariant = {
    missing_docs: "Complete your document verification",
    pending_review: "Your account is pending approval",
    rejected: "Verification needs your attention",
    account_rejected: "Your vendor application was rejected",
    account_suspended: "Your account is temporarily restricted",
  } as const;

  const iconByVariant = {
    missing_docs: FileWarning,
    pending_review: Clock,
    rejected: AlertCircle,
    account_rejected: AlertCircle,
    account_suspended: AlertCircle,
  } as const;

  const toneByVariant = {
    missing_docs: "border-warning/25 bg-warning-soft",
    pending_review: "border-warning/25 bg-warning-soft",
    rejected: "border-destructive/30 bg-destructive/10",
    account_rejected: "border-destructive/30 bg-destructive/10",
    account_suspended: "border-destructive/30 bg-destructive/10",
  } as const;

  const Icon = iconByVariant[bannerVariant];
  const title = titleByVariant[bannerVariant];

  let description = "";
  if (bannerVariant === "missing_docs") {
    description = `Upload the remaining documents to continue: ${missingDocuments.join(", ")}. Catalog, inventory, and orders stay locked until all documents are uploaded and approved.`;
  } else if (bannerVariant === "rejected") {
    const rejectedLabels = [
      ...rejectedDocuments.map((doc) => doc.type),
      ...(bankStatus === "rejected" ? ["Bank account"] : []),
    ];
    description = `Please fix the rejected item(s): ${rejectedLabels.join(", ")}. Platform operations are paused until verification is complete.`;
  } else if (bannerVariant === "pending_review") {
    description =
      "Some features are limited while your application is under review. You can explore the platform, but you won't be able to add products or receive orders until approved.";
  } else if (bannerVariant === "account_rejected") {
    description =
      "Your application was not approved. Review your profile and documents, then resubmit from onboarding.";
  } else {
    description =
      "Your account access is limited. Contact support if you believe this is a mistake.";
  }

  return (
    <div className={cn("relative w-full rounded-lg border px-4 py-3 sm:px-6", toneByVariant[bannerVariant], className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background/70">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {bannerVariant === "pending_review" && <StatusBadge status="pending" />}
              {bannerVariant === "missing_docs" && (
                <span className="text-xs text-muted-foreground">
                  Progress: {approvedDocumentCount}/{totalRequired} approved
                  {pendingDocuments.length > 0 ? ` · ${pendingDocuments.length} awaiting review` : ""}
                </span>
              )}
              {bannerVariant === "pending_review" && (
                <span className="text-xs text-muted-foreground">
                  Estimated review time: 1–2 business days
                </span>
              )}
            </div>

            {(bannerVariant === "missing_docs" || bannerVariant === "rejected") && (
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to={onboardingHref}>
                  {bannerVariant === "missing_docs" ? "Upload documents" : "Fix verification"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {canDismiss && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground sm:static"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default VendorVerificationBanner;
