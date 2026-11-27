import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Clock, Hash, Package, Phone, Siren, Store, User, Volume2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type EquipmentEmergencyDto } from "@/app/services/adminApi";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";

export const ADMIN_EMERGENCIES_QUERY_KEY = ["admin-equipment-emergencies"] as const;

/** How often the alarm repeats while an emergency is waiting for acknowledge. */
const ALARM_REPEAT_MS = 3000;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioContext = new AudioCtx();
  return sharedAudioContext;
}

/** Browsers block sound until the user has interacted with the page. Resume on the first click or key press. */
function useUnlockAudioOnInteraction(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled]);
}

/** Two-tone siren beep. Returns false when the browser still blocks audio. */
function playAlarm(): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  if (ctx.state !== "running") return false;

  const start = ctx.currentTime;
  [880, 660, 880].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + index * 0.22;
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  });
  return true;
}

export function useAdminEmergencies(enabled: boolean) {
  return useQuery({
    queryKey: ADMIN_EMERGENCIES_QUERY_KEY,
    queryFn: () => adminApi.getEquipmentEmergencies({ quiet: true }),
    enabled,
    refetchInterval: 5000,
    // Keep checking while the admin is on another tab, otherwise a new emergency would go unnoticed.
    refetchIntervalInBackground: true,
  });
}

export function AdminEmergencyAlert({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useAdminEmergencies(enabled);
  const openItems = (data ?? []).filter((item) => item.status === "open");
  const openCount = openItems.length;
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useUnlockAudioOnInteraction(enabled);

  // Repeat the alarm until every open emergency is acknowledged. A new emergency after a quiet period un-mutes it.
  useEffect(() => {
    if (openCount === 0) setMuted(false);
  }, [openCount]);

  useEffect(() => {
    if (!enabled || openCount === 0 || muted) return;
    const tick = () => setSoundBlocked(!playAlarm());
    tick();
    const timer = window.setInterval(tick, ALARM_REPEAT_MS);
    return () => window.clearInterval(timer);
  }, [enabled, openCount, muted]);

  // Flash the tab title so the emergency is visible from another tab too.
  useEffect(() => {
    if (!enabled || openCount === 0) return;
    const original = document.title;
    let on = true;
    const flash = () => {
      document.title = on ? `🚨 Emergency (${openCount})` : original;
      on = !on;
    };
    flash();
    const timer = window.setInterval(flash, 1000);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [enabled, openCount]);

  const acknowledge = useMutation({
    mutationFn: (id: string) => adminApi.acknowledgeEquipmentEmergency(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_EMERGENCIES_QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message || "Could not acknowledge the emergency."),
  });

  if (!enabled || openItems.length === 0) return null;

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        hideCloseButton
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-t-4 border-t-red-600 p-0 sm:max-w-lg sm:p-0"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 pr-4 sm:px-5">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/25" />
              <Siren className="relative h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">Equipment emergency</span>
            {openItems.length > 1 && (
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                {openItems.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="shrink-0 rounded-full border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={muted ? "Turn alarm sound on" : "Mute alarm sound"}
              title={muted ? "Turn alarm sound on" : "Mute alarm sound"}
            >
              {muted ? <BellOff className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </DialogTitle>
          <DialogDescription className="text-xs">
            A customer needs urgent help. Acknowledge to let them know BlinksMed has seen it.
          </DialogDescription>
          {soundBlocked && !muted && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Sound is blocked by the browser. Click anywhere on this page to turn the alarm on.
            </p>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-3 sm:p-4">
          {openItems.map((item) => (
            <EmergencyCard
              key={item.id}
              item={item}
              busy={acknowledge.isPending}
              onAcknowledge={() => acknowledge.mutate(item.id)}
              onOpenOrder={() => {
                // Opening the order counts as seeing it: acknowledge (tells the customer), close the popup, then go.
                acknowledge.mutate(item.id, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: ["admin-order-emergencies", item.orderId] });
                    navigate(`/admin/orders/${item.orderId}`);
                  },
                });
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmergencyCard({
  item,
  busy,
  onAcknowledge,
  onOpenOrder,
}: {
  item: EquipmentEmergencyDto;
  busy: boolean;
  onAcknowledge: () => void;
  onOpenOrder: () => void;
}) {
  const raisedAt = new Date(item.createdAt);
  const raisedLabel = Number.isNaN(raisedAt.getTime())
    ? null
    : raisedAt.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
      {/* Product + issue */}
      <div className="space-y-2.5 border-b p-3 sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Package className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 break-words text-base font-semibold leading-snug text-foreground">
              {item.productName}
            </p>
          </div>
          {raisedLabel && (
            <span className="flex shrink-0 items-center gap-1 pl-6 text-xs text-muted-foreground sm:pl-0 sm:pt-1">
              <Clock className="h-3 w-3" />
              {raisedLabel}
            </span>
          )}
        </div>
        <div className="rounded-lg border-l-4 border-l-red-500 bg-muted/60 p-2.5 sm:p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
          <p className="mt-0.5 font-medium text-foreground">{item.reasonLabel}</p>
          {item.note && (
            <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">{item.note}</p>
          )}
        </div>
      </div>

      {/* Customer / order details */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3 sm:gap-y-3 sm:p-4">
        <DetailItem icon={User} label="Customer" value={item.customerName} />
        <DetailItem
          icon={Phone}
          label="Phone"
          value={item.customerPhone ?? "—"}
          href={item.customerPhone ? `tel:${item.customerPhone}` : undefined}
        />
        <DetailItem icon={Hash} label="Order" value={item.orderNumber} className="col-span-2 sm:col-span-1" />
        <DetailItem icon={Store} label="Vendor" value={item.vendorName} className="col-span-2 sm:col-span-1" />
      </dl>

      {item.vendorNotified && (
        <div className="mx-3 mb-3 flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900 sm:mx-4 dark:bg-amber-950/50 dark:text-amber-200">
          <Bell className="h-3.5 w-3.5 shrink-0" />
          Vendor bell was also alerted.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3 sm:flex sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={onOpenOrder}>
          Open order
        </Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={onAcknowledge}>
          Acknowledge
        </Button>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className ?? ""}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="break-words font-medium text-foreground">
          {href ? (
            <a href={href} className="underline-offset-2 hover:underline">
              {value}
            </a>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
}
