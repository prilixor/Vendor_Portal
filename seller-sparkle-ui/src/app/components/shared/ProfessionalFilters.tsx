import type { ReactNode } from "react";
import { CheckCircle2, Circle, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { cn } from "@/app/helpers/utils";

export type ActiveFilterChip = {
  key: string;
  label: string;
  onClear: () => void;
};

type FilterSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  activeCount?: number;
  onOpenFilters: () => void;
  className?: string;
  "aria-label"?: string;
};

/** Search field + filter button with optional active-count badge. */
export function FilterSearchBar({
  value,
  onChange,
  placeholder = "Search…",
  activeCount = 0,
  onOpenFilters,
  className,
  "aria-label": ariaLabel = "Search",
}: FilterSearchBarProps) {
  const hasFilters = activeCount > 0;

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 rounded-xl pl-9"
          aria-label={ariaLabel}
        />
      </div>
      <Button
        type="button"
        variant={hasFilters ? "default" : "outline"}
        className="relative h-11 w-11 shrink-0 rounded-xl px-0"
        onClick={onOpenFilters}
        aria-label="Open filters"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {hasFilters ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-foreground ring-1 ring-border">
            {activeCount}
          </span>
        ) : null}
      </Button>
    </div>
  );
}

type ActiveFilterChipsProps = {
  chips: ActiveFilterChip[];
  /** Shown only when provided. Use "Clear all" for multi-filter screens; "Clear" for single-dimension filters. */
  onClearAll?: () => void;
  clearLabel?: string;
  className?: string;
};

/** Removable chips shown under the search bar when filters are active. */
export function ActiveFilterChips({
  chips,
  onClearAll,
  clearLabel = "Clear all",
  className,
}: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClear}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary/15"
        >
          {chip.label}
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

type FilterPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onReset?: () => void;
  /** Label for the header reset action. Use "Clear all" only when multiple filters can apply. */
  resetLabel?: string;
  onApply: () => void;
  applyLabel?: string;
  children: ReactNode;
};

/** Side sheet used as the professional filter panel. */
export function FilterPanel({
  open,
  onOpenChange,
  title = "Filters",
  description,
  onReset,
  resetLabel = "Clear all",
  onApply,
  applyLabel = "Show results",
  children,
}: FilterPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-xl font-bold tracking-tight">{title}</SheetTitle>
              {description ? (
                <SheetDescription>{description}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Refine results</SheetDescription>
              )}
            </div>
            {onReset ? (
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={onReset}>
                {resetLabel}
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        <SheetFooter className="flex-row gap-3 border-t border-border px-6 py-4 sm:space-x-0">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-[2] rounded-xl"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            {applyLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FilterSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="border-b border-border/80 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  );
}

type FilterSelectRowProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
  showDivider?: boolean;
};

export function FilterSelectRow({ label, selected, onClick, count, showDivider }: FilterSelectRowProps) {
  return (
    <>
      {showDivider ? <div className="h-px bg-border" /> : null}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
          selected ? "bg-primary/10" : "hover:bg-muted/50",
        )}
      >
        <span className={cn("min-w-0 flex-1 text-sm", selected ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
          {label}
        </span>
        {typeof count === "number" ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
              selected ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
        {selected ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
        )}
      </button>
    </>
  );
}

type FilterTileOption = { id: string; label: string };

type FilterTileGridProps = {
  options: FilterTileOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function FilterTileGrid({ options, value, onChange, className }: FilterTileGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 p-3", className)}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-xl border px-3 py-3 text-center text-sm transition-colors",
              selected
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-background font-medium text-foreground hover:bg-muted/60",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
