import { useEffect, useMemo, useState, type ReactNode } from "react";
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
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 space-y-0.5 border-b border-border px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 space-y-0.5">
              <SheetTitle className="text-lg font-bold tracking-tight">{title}</SheetTitle>
              {description ? (
                <SheetDescription className="text-xs">{description}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">Refine results</SheetDescription>
              )}
            </div>
            {onReset ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs text-muted-foreground" onClick={onReset}>
                {resetLabel}
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        {/* Children own their scroll regions (e.g. long category lists). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-3">{children}</div>

        <SheetFooter className="shrink-0 flex-row gap-2 border-t border-border px-5 py-3 sm:space-x-0">
          <Button type="button" variant="outline" className="h-10 flex-1 rounded-lg" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 flex-[2] rounded-lg"
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

export function FilterSection({
  title,
  children,
  className,
  hint,
  fill,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** Optional helper text under the section title (e.g. "20 categories"). */
  hint?: string;
  /** Grow to fill remaining sheet height (use for long scrollable lists). */
  fill?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-card",
        fill && "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/70 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          {hint ? <span className="text-[11px] tabular-nums text-muted-foreground">{hint}</span> : null}
        </div>
      </div>
      <div className={cn(fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
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
      {showDivider ? <div className="h-px bg-border/70" /> : null}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          selected ? "bg-primary/10" : "hover:bg-muted/50",
        )}
      >
        <span className={cn("min-w-0 flex-1 text-sm", selected ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
          {label}
        </span>
        {typeof count === "number" ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              selected ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        ) : null}
        {selected ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        )}
      </button>
    </>
  );
}

type FilterCategoryListProps = {
  options: string[];
  /** Optional item counts per category name (e.g. Baby Care → 21). */
  counts?: Record<string, number>;
  /** Total count for the "All categories" row. */
  allCount?: number;
  /** `undefined` means "All categories". */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
  searchPlaceholder?: string;
  /** Show search once option count reaches this threshold. Default 8. */
  searchThreshold?: number;
  /** Max height of the scrollable list area. */
  listClassName?: string;
  /** Reset internal search when this becomes false (e.g. sheet closed). */
  active?: boolean;
  /** Fit list height to rows (no min-height filler). Use in modals with few categories. */
  compact?: boolean;
};

/**
 * Category picker for filter sheets with many options (20+).
 * Fills remaining sheet height and scrolls automatically when content exceeds the screen.
 */
export function FilterCategoryList({
  options,
  counts,
  allCount,
  value,
  onChange,
  allLabel = "All categories",
  searchPlaceholder = "Search categories…",
  searchThreshold = 8,
  listClassName,
  active = true,
  compact = false,
}: FilterCategoryListProps) {
  const [query, setQuery] = useState("");
  const showSearch = options.length >= searchThreshold;

  useEffect(() => {
    if (!active) setQuery("");
  }, [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((name) => name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className={cn("flex flex-col", !compact && "min-h-0 flex-1")}>
      {showSearch ? (
        <div className="shrink-0 border-b border-border/70 px-2.5 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 rounded-lg pl-8 pr-8 text-sm"
              aria-label="Search categories"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear category search"
                onClick={() => setQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {query.trim() ? (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {filtered.length} of {options.length} categories
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-y-auto overscroll-contain",
          !compact && "min-h-[8rem] flex-1",
          "[scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25",
          "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40",
          listClassName,
        )}
      >
        {!query.trim() ? (
          <FilterSelectRow
            label={allLabel}
            selected={value === undefined}
            onClick={() => onChange(undefined)}
            count={allCount}
          />
        ) : null}

        {filtered.map((name, index) => (
          <FilterSelectRow
            key={name}
            label={name}
            selected={value === name}
            onClick={() => {
              onChange(name);
              setQuery("");
            }}
            count={counts?.[name]}
            showDivider={!query.trim() || index > 0}
          />
        ))}

        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm font-medium text-foreground">No categories match</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a shorter search term.</p>
            <Button type="button" variant="ghost" size="sm" className="mt-2 h-8" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type FilterTileOption = { id: string; label: string };

type FilterTileGridProps = {
  options: FilterTileOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

/** Compact pill / segmented control — preferred for 3–5 stock options. */
export function FilterTileGrid({ options, value, onChange, className }: FilterTileGridProps) {
  return (
    <div className={cn("p-2.5", className)} role="radiogroup" aria-label="Stock">
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted/60 p-1">
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={cn(
                "inline-flex h-8 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all sm:text-[13px]",
                selected
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
