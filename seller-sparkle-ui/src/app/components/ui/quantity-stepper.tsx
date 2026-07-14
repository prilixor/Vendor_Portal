import { Minus, Plus } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export function QuantityStepper({
  label,
  value,
  min,
  max,
  onChange,
  required,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <div className="inline-flex h-9 items-center rounded-full border border-border bg-background shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
