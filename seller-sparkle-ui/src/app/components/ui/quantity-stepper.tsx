import { Minus, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/helpers/utils";

export function QuantityStepper({
  label,
  value,
  min,
  max,
  onChange,
  required,
  orientation = "stacked",
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  required?: boolean;
  orientation?: "stacked" | "inline";
  className?: string;
}) {
  const labelNode = (
    <span className={cn("font-medium text-muted-foreground", orientation === "inline" ? "text-sm" : "text-xs")}>
      {label}
      {required ? (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </span>
  );

  const controls = (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-md text-foreground hover:bg-muted"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </Button>
      <span className="min-w-[2.25rem] select-none text-center text-sm font-bold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-md text-foreground hover:bg-muted"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </Button>
    </div>
  );

  if (orientation === "inline") {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        {labelNode}
        {controls}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {labelNode}
      {controls}
    </div>
  );
}
