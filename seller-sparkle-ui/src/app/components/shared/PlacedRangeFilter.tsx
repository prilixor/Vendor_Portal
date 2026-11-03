import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Calendar } from "@/app/components/ui/calendar";
import { Switch } from "@/app/components/ui/switch";
import { cn } from "@/app/helpers/utils";

export type PlacedPresetId = "any" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

const placedPresetOptions: { id: Exclude<PlacedPresetId, "custom">; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

function toDatetimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocal(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateOnly(value: string): Date | undefined {
  const date = parseLocal(value);
  if (!date) return undefined;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function timeOf(value: string, fallback: string): string {
  const date = parseLocal(value);
  if (!date) return fallback;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combine(date: Date, time: string): string {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0, 0, 0);
  return toDatetimeLocal(next);
}

function isStartOfDay(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

function isEndOfDay(date: Date): boolean {
  return date.getHours() === 23 && date.getMinutes() === 59;
}

function isWholeDay(from: string, to: string): boolean {
  const start = parseLocal(from);
  const end = parseLocal(to);
  return Boolean(start && end && isStartOfDay(start) && isEndOfDay(end));
}

function rangeForPreset(id: Exclude<PlacedPresetId, "any" | "custom">): { from: string; to: string } {
  const start = new Date();
  const end = new Date();
  if (id === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (id === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (id === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (id === "month") {
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 0, 0);
  return { from: toDatetimeLocal(start), to: toDatetimeLocal(end) };
}

export function inferPreset(from: string, to: string): PlacedPresetId {
  if (!from && !to) return "any";
  for (const option of placedPresetOptions) {
    if (option.id === "any") continue;
    const range = rangeForPreset(option.id);
    if (range.from === from && range.to === to) return option.id;
  }
  return "custom";
}

function formatWhen(date: Date, withTime: boolean): string {
  return format(date, withTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy");
}

export function formatRangeSummary(from: string, to: string): string {
  const start = parseLocal(from);
  const end = parseLocal(to);
  if (start && end) {
    const hideTime = isStartOfDay(start) && isEndOfDay(end);
    const sameDay = start.toDateString() === end.toDateString();
    if (hideTime && sameDay) return formatWhen(start, false);
    if (hideTime) return `${formatWhen(start, false)} – ${formatWhen(end, false)}`;
    if (sameDay) return `${format(start, "d MMM yyyy")}, ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
    return `${formatWhen(start, true)} – ${formatWhen(end, true)}`;
  }
  if (start) return `From ${formatWhen(start, !isStartOfDay(start))}`;
  if (end) return `Until ${formatWhen(end, !isEndOfDay(end))}`;
  return "Any time";
}

/** False when both ends are set and the end instant is earlier than the start. */
export function isPlacedRangeOrdered(from: string, to: string): boolean {
  const start = parseLocal(from);
  const end = parseLocal(to);
  if (!start || !end) return true;
  return start.getTime() <= end.getTime();
}

/** Keeps From at or before To. Same-day time edits clamp instead of swapping the clock. */
function normalizeRange(from: string, to: string): { from: string; to: string } {
  const start = parseLocal(from);
  const end = parseLocal(to);
  if (!start || !end || start.getTime() <= end.getTime()) return { from, to };
  if (start.toDateString() === end.toDateString()) return { from, to: from };
  return { from: to, to: from };
}

export function placedFilterLabel(from: string, to: string): string {
  const appliedPreset = inferPreset(from, to);
  const presetLabel = placedPresetOptions.find((option) => option.id === appliedPreset)?.label;
  return presetLabel && appliedPreset !== "any" ? presetLabel : formatRangeSummary(from, to);
}

/** Local wall time from the picker. The API stores placed time in UTC. */
export function placedLocalToUtcIso(localValue: string): string | undefined {
  return parseLocal(localValue)?.toISOString();
}

function splitClock(value: string): { hour: number; minute: number; period: "AM" | "PM" } {
  const [hourRaw, minuteRaw] = (value || "00:00").split(":");
  let hour24 = Number(hourRaw);
  let minute = Number(minuteRaw);
  if (!Number.isFinite(hour24)) hour24 = 0;
  if (!Number.isFinite(minute)) minute = 0;
  hour24 = ((hour24 % 24) + 24) % 24;
  minute = Math.min(59, Math.max(0, minute));
  return { hour: hour24 % 12 || 12, minute, period: hour24 >= 12 ? "PM" : "AM" };
}

function joinClock(hour: number, minute: number, period: "AM" | "PM"): string {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(hour24)}:${pad(minute)}`;
}

function clockMinutes(hour: number, minute: number, period: "AM" | "PM"): number {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return hour24 * 60 + minute;
}

function fromMinutes(total: number): { hour: number; minute: number; period: "AM" | "PM" } {
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  return splitClock(`${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}

function stepHour(clock: { hour: number; minute: number; period: "AM" | "PM" }, delta: number) {
  const next = clockMinutes(clock.hour, clock.minute, clock.period) + delta * 60;
  if (next < 0 || next >= 24 * 60) return null;
  return fromMinutes(next);
}

function stepMinute(clock: { hour: number; minute: number; period: "AM" | "PM" }, delta: number) {
  const next = clockMinutes(clock.hour, clock.minute, clock.period) + delta;
  if (next < 0 || next >= 24 * 60) return null;
  return fromMinutes(next);
}

function TimeTick({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string;
  direction: "down" | "up";
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "down" ? Minus : Plus;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

function ClockStep({
  caption,
  value,
  downLabel,
  upLabel,
  downDisabled,
  upDisabled,
  onDown,
  onUp,
}: {
  caption: string;
  value: string;
  downLabel: string;
  upLabel: string;
  downDisabled?: boolean;
  upDisabled?: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5">
        <TimeTick label={downLabel} direction="down" disabled={downDisabled} onClick={onDown} />
        <span className="w-7 text-center text-lg font-semibold tabular-nums leading-none text-foreground">{value}</span>
        <TimeTick label={upLabel} direction="up" disabled={upDisabled} onClick={onUp} />
      </div>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{caption}</span>
    </div>
  );
}

function PlacedTimeField({
  label,
  value,
  minTime,
  onChange,
}: {
  label: string;
  value: string;
  /** 24-hour `HH:mm`. Earlier choices stay unavailable. */
  minTime?: string;
  onChange: (value: string) => void;
}) {
  const clock = splitClock(value);
  const blocked = (next: { hour: number; minute: number; period: "AM" | "PM" } | null) =>
    !next || Boolean(minTime && joinClock(next.hour, next.minute, next.period) < minTime);
  const apply = (next: { hour: number; minute: number; period: "AM" | "PM" } | null) => {
    if (!next || blocked(next)) return;
    onChange(joinClock(next.hour, next.minute, next.period));
  };
  const hourDown = stepHour(clock, -1);
  const hourUp = stepHour(clock, 1);
  const minuteDown = stepMinute(clock, -1);
  const minuteUp = stepMinute(clock, 1);

  return (
    <div className="rounded-xl border border-border bg-background px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-end gap-1">
          <ClockStep
            caption="Hour"
            value={String(clock.hour)}
            downLabel={`Earlier hour for ${label}`}
            upLabel={`Later hour for ${label}`}
            downDisabled={blocked(hourDown)}
            upDisabled={blocked(hourUp)}
            onDown={() => apply(hourDown)}
            onUp={() => apply(hourUp)}
          />
          <span className="mb-4 px-0.5 text-lg font-semibold leading-none text-muted-foreground">:</span>
          <ClockStep
            caption="Minute"
            value={String(clock.minute).padStart(2, "0")}
            downLabel={`Earlier minute for ${label}`}
            upLabel={`Later minute for ${label}`}
            downDisabled={blocked(minuteDown)}
            upDisabled={blocked(minuteUp)}
            onDown={() => apply(minuteDown)}
            onUp={() => apply(minuteUp)}
          />
        </div>
        <div className="grid w-14 shrink-0 grid-cols-1 overflow-hidden rounded-lg border border-border" role="group" aria-label={`${label} period`}>
          {(["AM", "PM"] as const).map((period) => {
            const next = { hour: clock.hour, minute: clock.minute, period };
            const selected = clock.period === period;
            return (
              <button
                key={period}
                type="button"
                disabled={blocked(next)}
                aria-pressed={selected}
                onClick={() => apply(next)}
                className={cn(
                  "h-8 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                  selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {period}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ORDER_CALENDAR_START = new Date(2024, 0, 1);

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function OrderPlacedCalendar({
  from,
  to,
  onSelect,
}: {
  from: string;
  to: string;
  onSelect: (picked: DateRange | undefined) => void;
}) {
  const today = new Date();
  const currentMonth = startOfMonth(today);
  const earliestMonth = startOfMonth(ORDER_CALENDAR_START);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = dateOnly(from);
    const initial = selected ? startOfMonth(selected) : currentMonth;
    if (initial.getTime() > currentMonth.getTime()) return currentMonth;
    if (initial.getTime() < earliestMonth.getTime()) return earliestMonth;
    return initial;
  });

  const years: number[] = [];
  for (let year = earliestMonth.getFullYear(); year <= currentMonth.getFullYear(); year += 1) {
    years.push(year);
  }

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const atStart = visibleMonth.getTime() <= earliestMonth.getTime();
  const atEnd = visibleMonth.getTime() >= currentMonth.getTime();

  const showMonth = (next: Date) => {
    const month = startOfMonth(next);
    if (month.getTime() < earliestMonth.getTime() || month.getTime() > currentMonth.getTime()) return;
    setVisibleMonth(month);
  };

  const startDay = dateOnly(from);
  const endDay = dateOnly(to);
  const sameDay = Boolean(startDay && endDay && startDay.getTime() === endDay.getTime());
  const selectedRange: DateRange | undefined = startDay
    ? { from: startDay, to: endDay && !sameDay ? endDay : undefined }
    : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous month"
          disabled={atStart}
          onClick={() => showMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-expanded={monthPickerOpen}
          onClick={() => setMonthPickerOpen((open) => !open)}
          className={cn(
            "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 text-sm font-medium text-foreground",
            monthPickerOpen && "border-primary text-primary",
          )}
        >
          <span className="truncate">{format(visibleMonth, "MMMM yyyy")}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground", monthPickerOpen && "rotate-180 text-primary")} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          disabled={atEnd}
          onClick={() => showMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {monthPickerOpen ? (
        <div className="space-y-2 rounded-xl border border-border bg-background p-2">
          <div className="flex gap-1">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  const month = year === currentMonth.getFullYear()
                    ? Math.min(visibleMonth.getMonth(), currentMonth.getMonth())
                    : visibleMonth.getMonth();
                  showMonth(new Date(year, month, 1));
                }}
                className={cn(
                  "h-8 flex-1 rounded-lg text-xs font-semibold",
                  year === visibleMonth.getFullYear()
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {year}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const disabled = visibleMonth.getFullYear() === currentMonth.getFullYear() && index > currentMonth.getMonth();
              const selected = index === visibleMonth.getMonth();
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    showMonth(new Date(visibleMonth.getFullYear(), index, 1));
                    setMonthPickerOpen(false);
                  }}
                  className={cn(
                    "h-8 rounded-lg text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30",
                    selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                  )}
                >
                  {format(new Date(2026, index, 1), "MMM")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {atEnd ? null : (
        <button
          type="button"
          onClick={() => showMonth(currentMonth)}
          className="text-xs font-semibold text-primary"
        >
          Jump to this month
        </button>
      )}
      <div className="flex justify-center">
        <Calendar
          mode="range"
          month={visibleMonth}
          onMonthChange={showMonth}
          selected={selectedRange}
          onSelect={onSelect}
          fromDate={earliestMonth}
          toDate={today}
          disableNavigation
          className="p-0"
          classNames={{
            caption: "hidden",
            nav: "hidden",
            month: "space-y-2",
            row: "mt-1 flex w-full",
            day_today:
              "bg-transparent font-semibold text-primary ring-1 ring-inset ring-primary/50 aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:ring-0",
          }}
        />
      </div>
    </div>
  );
}

function RangeEndpoint({
  label,
  value,
  allDay,
  active,
  onClick,
}: {
  label: string;
  value: string;
  allDay: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const date = parseLocal(value);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted/50",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
        {date ? format(date, "d MMM yyyy") : "Select"}
      </span>
      <span className={cn("block truncate text-xs", active && !allDay && date ? "font-semibold text-primary" : "text-muted-foreground")}>
        {date ? (allDay ? "All day" : format(date, "h:mm a")) : "Choose a day"}
      </span>
    </button>
  );
}

function CustomPlacedRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { preset: PlacedPresetId; from: string; to: string }) => void;
}) {
  const [specificTimes, setSpecificTimes] = useState(() => Boolean(from && to && !isWholeDay(from, to)));
  const [focus, setFocus] = useState<"from" | "to">("from");
  const start = parseLocal(from);
  const end = parseLocal(to);
  const hasDay = Boolean(start);
  const sameDay = Boolean(start && end && start.toDateString() === end.toDateString());
  const allDay = !specificTimes;

  useEffect(() => {
    if (!from || !to || isPlacedRangeOrdered(from, to)) return;
    const next = normalizeRange(from, to);
    onChange({ preset: "custom", from: next.from, to: next.to });
  }, [from, to, onChange]);

  const commit = (nextFrom: string, nextTo: string) => {
    const next = normalizeRange(nextFrom, nextTo);
    onChange({ preset: "custom", from: next.from, to: next.to });
  };

  return (
    <div className="space-y-2.5 border-t border-border/70 pt-2.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
        <RangeEndpoint
          label="From"
          value={from}
          allDay={allDay || !hasDay}
          active={hasDay && focus === "from"}
          onClick={() => {
            setFocus("from");
            if (hasDay) setSpecificTimes(true);
          }}
        />
        <span className="self-center text-[11px] font-medium text-muted-foreground">to</span>
        <RangeEndpoint
          label="To"
          value={to}
          allDay={allDay || !hasDay}
          active={hasDay && focus === "to"}
          onClick={() => {
            setFocus("to");
            if (hasDay) setSpecificTimes(true);
          }}
        />
      </div>

      {!hasDay ? <p className="text-center text-xs text-muted-foreground">Select a start day, then an end day.</p> : null}

      <OrderPlacedCalendar
        from={from}
        to={to}
        onSelect={(picked) => {
          if (!picked?.from) {
            onChange({ preset: "custom", from: "", to: "" });
            return;
          }
          const startTime = specificTimes ? timeOf(from, "00:00") : "00:00";
          const endTime = specificTimes ? timeOf(to, "23:59") : "23:59";
          commit(
            combine(picked.from, startTime),
            combine(picked.to ?? picked.from, picked.to ? endTime : "23:59"),
          );
        }}
      />

      {hasDay ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">All day</p>
            <p className="text-[11px] text-muted-foreground">12:00 AM – 11:59 PM</p>
          </div>
          <Switch
            checked={allDay}
            aria-label="All day"
            onCheckedChange={(on) => {
              if (!start) return;
              if (on) {
                setSpecificTimes(false);
                commit(combine(start, "00:00"), combine(end ?? start, "23:59"));
                return;
              }
              setSpecificTimes(true);
            }}
          />
        </div>
      ) : null}

      {hasDay && specificTimes ? (
        <div className="space-y-1.5">
          <PlacedTimeField
            label={focus === "from" ? "Start" : "End"}
            value={timeOf(focus === "from" ? from : to, focus === "from" ? "00:00" : "23:59")}
            minTime={focus === "to" && sameDay ? timeOf(from, "00:00") : undefined}
            onChange={(next) => {
              if (!start) return;
              if (focus === "from") {
                commit(combine(start, next), to || combine(start, "23:59"));
                return;
              }
              const base = end ?? start;
              const earliest = sameDay ? timeOf(from, "00:00") : undefined;
              const time = earliest && next < earliest ? earliest : next;
              commit(from || combine(base, "00:00"), combine(base, time));
            }}
          />
          {focus === "to" && sameDay && start ? (
            <p className="text-center text-[11px] text-muted-foreground">
              End stays at or after {format(start, "h:mm a")}. Pick the next day to pass midnight.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PlacedRangeEditor({
  preset,
  from,
  to,
  onChange,
}: {
  preset: PlacedPresetId;
  from: string;
  to: string;
  onChange: (next: { preset: PlacedPresetId; from: string; to: string }) => void;
}) {
  const choosePreset = (id: Exclude<PlacedPresetId, "custom">) => {
    if (id === "any") {
      onChange({ preset: "any", from: "", to: "" });
      return;
    }
    const range = rangeForPreset(id);
    onChange({ preset: id, from: range.from, to: range.to });
  };

  const chipClass = (selected: boolean) =>
    cn(
      "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-foreground/80",
    );

  return (
    <div className="space-y-2.5 p-2.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="When the order was placed">
        {placedPresetOptions.map((option) => {
          const selected = preset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choosePreset(option.id)}
              className={chipClass(selected)}
            >
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={preset === "custom"}
          onClick={() => onChange({ preset: "custom", from, to })}
          className={chipClass(preset === "custom")}
        >
          Custom range
        </button>
      </div>

      {preset !== "custom" && (from || to) ? (
        <p className="px-1 text-center text-xs font-semibold text-foreground">{formatRangeSummary(from, to)}</p>
      ) : null}

      {preset === "custom" ? <CustomPlacedRange from={from} to={to} onChange={onChange} /> : null}
    </div>
  );
}
