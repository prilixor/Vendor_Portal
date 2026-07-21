import * as React from "react";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/helpers/utils";

export interface ChatMessageTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
}

export const ChatMessageTextarea = React.forwardRef<HTMLTextAreaElement, ChatMessageTextareaProps>(
  function ChatMessageTextarea(
    { value, onChange, onSubmit, submitDisabled, className, onKeyDown, rows = 2, ...props },
    ref,
  ) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!submitDisabled && value.trim()) {
          onSubmit();
        }
      }
    };

    return (
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        className={cn("min-h-[44px] max-h-[160px] resize-none py-2.5 leading-relaxed", className)}
        {...props}
      />
    );
  },
);
