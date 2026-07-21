import { AlertCircle, MessageSquare } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { AdminCommentHint } from "@/app/components/shared/AdminCommentHint";
import { sanitizeAdminComment } from "@/app/helpers/adminComment";
import { VendorDocument } from "@/app/models";

interface OnboardingRejectedHelpBannerProps {
  rejectedDocuments: VendorDocument[];
  rejectedBank: boolean;
  onGetHelp: () => void;
}

export function OnboardingRejectedHelpBanner({
  rejectedDocuments,
  rejectedBank,
  onGetHelp,
}: OnboardingRejectedHelpBannerProps) {
  const parts = [
    ...rejectedDocuments.map((doc) => doc.type),
    ...(rejectedBank ? ["Bank account"] : []),
  ];
  const summary =
    parts.length === 0
      ? "Some verification items were rejected."
      : `Rejected: ${parts.join(", ")}.`;
  const documentsWithComments = rejectedDocuments.filter(
    (doc) => sanitizeAdminComment(doc.rejectionReason),
  );

  return (
    <div className="mb-4 rounded-xl border border-destructive/35 bg-destructive/10 p-3.5 sm:p-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Verification needs attention</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {summary} Upload corrected files or contact support if you need help.
          </p>

          {documentsWithComments.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Admin comments on rejected documents:
              </p>
              {documentsWithComments.map((doc) => (
                <AdminCommentHint
                  key={doc.id}
                  itemLabel={doc.type}
                  comment={sanitizeAdminComment(doc.rejectionReason)}
                />
              ))}
            </div>
          )}

          {rejectedBank && (
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Bank rejection notes appear in Notifications if the admin left a comment.
            </p>
          )}

          <Button variant="outline" size="sm" className="mt-4" onClick={onGetHelp}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Get help
          </Button>
        </div>
      </div>
    </div>
  );
}
