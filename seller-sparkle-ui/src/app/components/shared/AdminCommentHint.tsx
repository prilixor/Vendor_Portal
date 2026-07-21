import { ShieldAlert } from "lucide-react";

import { cn } from "@/app/helpers/utils";

interface AdminCommentHintProps {
  comment?: string | null;
  itemLabel?: string;
  fallbackMessage?: string;
  className?: string;
}

/** Highlights admin rejection notes on rejected verification items. */
export function AdminCommentHint({
  comment,
  itemLabel,
  fallbackMessage = "Rejected by admin — please upload a corrected file.",
  className,
}: AdminCommentHintProps) {
  const hasComment = !!comment?.trim();
  const text = hasComment ? comment!.trim() : fallbackMessage;
  const title = hasComment
    ? itemLabel
      ? `${itemLabel} · Admin comment`
      : "Admin comment"
    : "Rejected";

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-destructive">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        <span>{title}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-destructive">{text}</p>
    </div>
  );
}
