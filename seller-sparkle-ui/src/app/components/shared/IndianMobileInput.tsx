import * as React from "react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/helpers/utils";
import { maskIndianMobileInput } from "@/app/helpers/indianMobilePhone";

type IndianMobileInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  /** When true, draws destructive border (e.g. validation error). */
  invalid?: boolean;
};

/**
 * Indian mobile field with a fixed +91 prefix.
 * Stores/emits only the 10-digit national number.
 */
export const IndianMobileInput = React.forwardRef<HTMLInputElement, IndianMobileInputProps>(
  ({ value, onChange, invalid, className, disabled, readOnly, id, placeholder = "9876543210", ...rest }, ref) => {
    return (
      <div
        className={cn(
          "flex h-10 w-full overflow-hidden rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          invalid && "border-destructive focus-within:ring-destructive",
          (disabled || readOnly) && "opacity-50",
          className,
        )}
      >
        <span
          className="flex shrink-0 items-center border-r border-input bg-muted/50 px-3 text-sm font-medium text-muted-foreground select-none"
          aria-hidden
        >
          +91
        </span>
        <Input
          ref={ref}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          className="h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          onChange={(e) => onChange(maskIndianMobileInput(e.target.value))}
          {...rest}
        />
      </div>
    );
  },
);
IndianMobileInput.displayName = "IndianMobileInput";
