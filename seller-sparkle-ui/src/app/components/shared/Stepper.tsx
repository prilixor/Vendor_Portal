import { Check } from "lucide-react";
import { cn } from "@/app/helpers/utils";

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  current: number; // 0-indexed
  onStepClick?: (idx: number) => void;
}

export const Stepper = ({ steps, current, onStepClick }: StepperProps) => (
  <div className="w-full">
    <div className="flex items-start">
      {steps.map((step, idx) => {
        const completed = idx < current;
        const active = idx === current;
        const reachable = idx <= current;
        return (
          <div key={step.label} className={cn("flex flex-1 items-start", idx === steps.length - 1 && "flex-none")}>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => reachable && onStepClick?.(idx)}
                disabled={!reachable}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  completed && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary-soft text-primary ring-4 ring-primary/15",
                  !completed && !active && "border-border bg-background text-muted-foreground",
                  reachable && "cursor-pointer hover:scale-105"
                )}
              >
                {completed ? <Check className="h-4 w-4" /> : idx + 1}
              </button>
              <div className="mt-2 hidden w-28 text-center sm:block">
                <p className={cn("text-xs font-semibold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </p>
                {step.description && <p className="mt-0.5 text-[10px] text-muted-foreground">{step.description}</p>}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn("mx-1 mt-5 h-0.5 flex-1 rounded-full transition-all", completed ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  </div>
);


