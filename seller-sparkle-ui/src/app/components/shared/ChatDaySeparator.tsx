import { formatChatDayLabel } from "@/app/helpers/chatDayLabel";

/** Centered day chip between chat message groups (Today / Yesterday / date). */
export function ChatDaySeparator({ date }: { date: string | Date }) {
  const label = formatChatDayLabel(date);
  if (!label) return null;

  return (
    <div className="flex items-center justify-center py-2" role="separator" aria-label={label}>
      <span className="rounded-full border border-border/60 bg-muted/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}
