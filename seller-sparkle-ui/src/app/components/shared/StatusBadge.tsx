import { cn } from "@/app/helpers/utils";
import { VerificationStatus } from "@/app/models";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

interface Props {
  status: VerificationStatus;
  className?: string;
}

const config: Record<VerificationStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved: { label: "Approved", cls: "bg-success-soft text-success border-success/20", Icon: CheckCircle2 },
  pending: { label: "Pending", cls: "bg-warning-soft text-warning border-warning/20", Icon: Clock },
  under_review: { label: "Under Review", cls: "bg-info-soft text-info border-info/20", Icon: Loader2 },
  rejected: { label: "Rejected", cls: "bg-destructive-soft text-destructive border-destructive/20", Icon: XCircle },
};

export const StatusBadge = ({ status, className }: Props) => {
  const { label, cls, Icon } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
};


