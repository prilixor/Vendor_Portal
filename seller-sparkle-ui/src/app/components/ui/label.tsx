import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/app/helpers/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

/**
 * Shared required marker — always `text-destructive` (red), never inherits label color.
 * Also strips a trailing `*` from string children so legacy `Label>Name *</Label>` stays red.
 */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => {
  let content = children;
  let showRequired = !!required;

  if (typeof children === "string") {
    const trimmed = children.trim();
    if (trimmed.endsWith("*")) {
      content = trimmed.replace(/\s*\*$/, "").trimEnd();
      showRequired = true;
    }
  }

  return (
    <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
      {content}
      {showRequired ? (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
