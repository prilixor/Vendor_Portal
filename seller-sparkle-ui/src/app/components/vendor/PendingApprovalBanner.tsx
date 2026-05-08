import { useState } from "react";
import { Clock, X } from "lucide-react";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { cn } from "@/app/helpers/utils";

interface PendingApprovalBannerProps {
  className?: string;
}

export const PendingApprovalBanner = ({ className }: PendingApprovalBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "relative w-full rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 sm:px-6",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Your account is pending approval
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Some features are limited while your application is under review. 
              You can explore the platform, but you won't be able to add products or receive orders until approved.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status="pending" />
              <span className="text-xs text-muted-foreground">
                Estimated review time: 1-2 business days
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-warning/20 hover:text-foreground sm:static sm:right-auto sm:top-auto"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalBanner;
