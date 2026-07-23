import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { cn } from "@/app/helpers/utils";

export type MultiSelectOption = {
  id: string;
  label: string;
  secondary?: string;
  badge?: string;
  searchText?: string;
};

type SearchableMultiSelectProps = {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Kept for API compatibility; list lives in the popover. */
  maxListHeightClass?: string;
  browseThreshold?: number;
};

/**
 * Professional multi-link picker: chips in a field + searchable dropdown.
 * Same pattern as modern admin tools (no permanent checklist clutter).
 */
export const SearchableMultiSelect = ({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyMessage = "No items available.",
  className,
}: SearchableMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as MultiSelectOption[];
  }, [options, selectedIds]);

  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) => {
        const aSel = selectedSet.has(a.id) ? 0 : 1;
        const bSel = selectedSet.has(b.id) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        return a.label.localeCompare(b.label);
      }),
    [options, selectedSet],
  );

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));
  const clearAll = () => onChange([]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={clearAll}
          >
            Clear all
          </button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-auto min-h-11 w-full justify-between px-3 py-2 font-normal hover:bg-background",
              selectedOptions.length === 0 && "text-muted-foreground",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left">
              {selectedOptions.length === 0 ? (
                <span className="text-sm">{placeholder}</span>
              ) : (
                selectedOptions.map((o) => (
                  <Badge
                    key={o.id}
                    variant="secondary"
                    className="max-w-full gap-1 rounded-md px-2 py-1 font-normal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.badge && (
                      <span className="font-mono text-[10px] font-semibold tracking-wide text-teal-700">
                        {o.badge}
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded-sm opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(o.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          remove(o.id);
                        }
                      }}
                      aria-label={`Remove ${o.label}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            filter={(value, search) => {
              const q = search.trim().toLowerCase();
              if (!q) return 1;
              return value.toLowerCase().includes(q) ? 1 : 0;
            }}
          >
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>
                {options.length === 0 ? emptyMessage : "No matches found."}
              </CommandEmpty>
              <CommandGroup>
                {sortedOptions.map((o) => {
                  const checked = selectedSet.has(o.id);
                  const filterValue = [o.label, o.badge, o.secondary, o.searchText]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <CommandItem
                      key={o.id}
                      value={filterValue}
                      onSelect={() => toggle(o.id)}
                      className="cursor-pointer gap-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/35",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{o.label}</span>
                          {o.badge && (
                            <span className="shrink-0 rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                              {o.badge}
                            </span>
                          )}
                        </span>
                        {o.secondary && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {o.secondary}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                <span>{selectedIds.length} selected</span>
                <button
                  type="button"
                  className="font-medium text-foreground hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
