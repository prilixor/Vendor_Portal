import { CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react";
import { cn } from "@/app/helpers/utils";
import type { DocumentChecklistItem } from "@/app/helpers/vendorVerification";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { AdminCommentHint } from "@/app/components/shared/AdminCommentHint";
import { sanitizeAdminComment } from "@/app/helpers/adminComment";

interface RequiredDocumentsChecklistProps {
  items: DocumentChecklistItem[];
  className?: string;
  compact?: boolean;
}

function statusIcon(status: DocumentChecklistItem["status"]) {
  if (status === "approved") return CheckCircle2;
  if (status === "rejected") return XCircle;
  if (status === "missing") return CircleDashed;
  return Clock;
}

function statusLabel(status: DocumentChecklistItem["status"]) {
  if (status === "missing") return "Not uploaded";
  if (status === "pending") return "Uploaded — awaiting review";
  if (status === "under_review") return "Under review";
  if (status === "approved") return "Approved";
  return "Rejected — re-upload required";
}

export function RequiredDocumentsChecklist({
  items,
  className,
  compact = false,
}: RequiredDocumentsChecklistProps) {
  const uploadedCount = items.filter((item) => item.status !== "missing").length;

  return (
    <div className={cn("rounded-xl border border-border/70 bg-muted/20", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Required documents</p>
          <p className="text-xs text-muted-foreground">
            Upload all five documents to complete KYC verification.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {uploadedCount}/{items.length} uploaded
        </p>
      </div>

      <ul className={cn("divide-y divide-border/60", compact ? "p-2" : "p-3")}>
        {items.map((item) => {
          const Icon = statusIcon(item.status);
          const isMissing = item.status === "missing";
          const isRejected = item.status === "rejected";

          return (
            <li
              key={item.type}
              className={cn(
                "flex items-start gap-3 rounded-lg px-2 py-2.5",
                isMissing && "bg-warning/5",
                isRejected && "bg-destructive/5",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  item.status === "approved" && "bg-success/15 text-success",
                  (item.status === "pending" || item.status === "under_review") &&
                    "bg-warning/15 text-warning",
                  isRejected && "bg-destructive/15 text-destructive",
                  isMissing && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{item.type}</p>
                  {item.status !== "missing" && <StatusBadge status={item.status} />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{statusLabel(item.status)}</p>
                {isRejected && item.document && (
                  <AdminCommentHint
                    className="mt-2"
                    itemLabel={item.type}
                    comment={sanitizeAdminComment(item.document.rejectionReason)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
