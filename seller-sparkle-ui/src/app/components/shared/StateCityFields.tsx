import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { FieldError } from "@/app/components/shared/FieldError";
import { vendorOnboardingApi } from "@/app/services/vendorOnboardingApi";
import { cn } from "@/app/helpers/utils";

type IndianState = { name: string; iso2: string };

type ComboboxProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
};

const StateCityCombobox = ({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  required,
  error,
}: ComboboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", error ? "border-destructive" : "")}
            disabled={disabled}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
        >
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option === value ? "" : option);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
};

export type StateCityFieldsProps = {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
  stateError?: string;
  cityError?: string;
  required?: boolean;
  className?: string;
  /** When true, uses a 2-column grid (State | City). */
  sideBySide?: boolean;
};

/**
 * Shared India State → City cascade (same lookup APIs as vendor onboarding / customer addresses).
 * Select state first; city options load for that state.
 */
export const StateCityFields = ({
  state,
  city,
  onStateChange,
  onCityChange,
  stateError,
  cityError,
  required,
  className,
  sideBySide = true,
}: StateCityFieldsProps) => {
  const [states, setStates] = useState<IndianState[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const [statesLoading, setStatesLoading] = useState(true);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      setLoadError(null);
      try {
        const list = await vendorOnboardingApi.getIndianStates();
        if (!cancelled) {
          setStates(
            (list ?? [])
              .filter((s) => s?.name && s?.iso2)
              .map((s) => ({ name: s.name, iso2: s.iso2 }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } catch {
        if (!cancelled) setLoadError("Failed to load states.");
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve ISO2 when editing an existing state name, or when states finish loading.
  useEffect(() => {
    if (!state?.trim() || states.length === 0) {
      if (!state?.trim()) setSelectedIso2(null);
      return;
    }
    const match = states.find((s) => s.name.toLowerCase() === state.trim().toLowerCase());
    setSelectedIso2(match?.iso2 ?? null);
  }, [state, states]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedIso2) {
      setCities([]);
      setCitiesLoading(false);
      return;
    }
    (async () => {
      setCitiesLoading(true);
      setLoadError(null);
      try {
        const list = await vendorOnboardingApi.getCitiesByState(selectedIso2);
        if (!cancelled) {
          setCities(
            (list ?? [])
              .map((c) => c.name)
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b)),
          );
        }
      } catch {
        if (!cancelled) {
          setCities([]);
          setLoadError("Failed to load cities.");
        }
      } finally {
        if (!cancelled) setCitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedIso2]);

  const handleStateChange = (name: string) => {
    const selected = states.find((s) => s.name === name);
    setSelectedIso2(selected?.iso2 ?? null);
    onStateChange(name);
    onCityChange("");
  };

  return (
    <div className={cn(sideBySide ? "grid gap-4 sm:grid-cols-2" : "space-y-3", className)}>
      <StateCityCombobox
        required={required}
        label="State"
        value={state}
        options={states.map((s) => s.name)}
        onChange={handleStateChange}
        placeholder={statesLoading ? "Loading states…" : "Select state"}
        disabled={statesLoading}
        error={stateError}
      />
      <StateCityCombobox
        required={required}
        label="City"
        value={city}
        options={cities}
        onChange={onCityChange}
        placeholder={
          citiesLoading ? "Loading cities…" : selectedIso2 || state ? "Select city" : "Select state first"
        }
        disabled={!selectedIso2 || citiesLoading}
        error={cityError}
      />
      {loadError && <p className="text-xs text-destructive sm:col-span-2">{loadError}</p>}
    </div>
  );
};
