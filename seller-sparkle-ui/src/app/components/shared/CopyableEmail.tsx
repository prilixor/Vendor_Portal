import { useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/app/helpers/utils";

type CopyableEmailProps = {
  email: string;
  className?: string;
  /** Extra classes for the email text */
  textClassName?: string;
  /** Truncate long emails with an ellipsis (default true). */
  truncate?: boolean;
  /** Show toast on successful copy (default true) */
  toastOnCopy?: boolean;
  /** Compact icon-only button (default true) */
  compact?: boolean;
};

/** Displays an email with a one-click copy control. Stops click bubbling for use inside links/cards. */
export function CopyableEmail({
  email,
  className,
  textClassName,
  toastOnCopy = true,
  compact = true,
  truncate = true,
}: CopyableEmailProps) {
  const [copied, setCopied] = useState(false);

  if (!email?.trim()) return null;

  const copy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email.trim());
      setCopied(true);
      if (toastOnCopy) toast.success("Email copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy email");
    }
  };

  const button = (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        compact ? "p-0.5" : "p-1",
        truncate ? "" : "ml-0.5 inline-flex align-text-bottom",
      )}
      aria-label={`Copy ${email}`}
      title="Copy email"
    >
      {copied ? (
        <Check className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "text-success")} />
      ) : (
        <Copy className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
    </button>
  );

  if (truncate) {
    return (
      <span className={cn("inline-flex min-w-0 max-w-full items-center gap-0.5", className)}>
        <span className={cn("min-w-0 truncate text-muted-foreground", textClassName)} title={email}>
          {email}
        </span>
        {button}
      </span>
    );
  }

  return (
    <span className={cn("inline max-w-full", className)}>
      <span className={cn("text-muted-foreground leading-snug [overflow-wrap:anywhere]", textClassName)} title={email}>
        {email}
      </span>
      {button}
    </span>
  );
}
