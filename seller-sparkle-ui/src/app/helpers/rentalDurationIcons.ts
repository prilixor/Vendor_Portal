import type { RentalValueTier } from "@/app/services/adminApi";

export const RENTAL_VALUE_TIERS: { value: RentalValueTier; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "better", label: "Better" },
  { value: "best_value", label: "Best Value" },
  { value: "maximum_savings", label: "Maximum Savings" },
];

export function rentalValueTierLabel(tier?: string | null): string {
  const key = (tier ?? "").toLowerCase().replace(/-/g, "_");
  return RENTAL_VALUE_TIERS.find((t) => t.value === key)?.label ?? "Good";
}

export function formatBillingCycles(cycles?: number | null): string {
  const n = Number(cycles ?? 0);
  if (!(n > 0)) return "";
  const text = Number.isInteger(n) ? String(n) : String(n);
  return n === 1 ? `${text} Billing Cycle` : `${text} Billing Cycles`;
}

export function dayPlanTitle(durationDays: number, fallbackLabel?: string): string {
  if (durationDays > 0) return `${durationDays}-Day Plan`;
  return fallbackLabel?.trim() || "Rental plan";
}

const getConfiguredApiOrigin = (): string | null => {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }

  const proxyTarget = (import.meta.env.VITE_DEV_API_PROXY_TARGET as string | undefined)?.trim();
  if (proxyTarget && /^https?:\/\//i.test(proxyTarget)) {
    try {
      return new URL(proxyTarget).origin;
    } catch {
      /* fall through */
    }
  }

  return null;
};

const getDevAssetOrigin = (): string | null => {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }
  return null;
};

/** Resolve stored upload refs / relative paths for rental icons. */
export function resolveRentalIconUrl(fileUrl?: string | null): string {
  if (!fileUrl) return "";
  const trimmed = fileUrl.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;

  const apiOrigin = getConfiguredApiOrigin();
  const devOrigin = getDevAssetOrigin();

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const absolute = new URL(trimmed);
      // Keep presigned S3/CDN and other external hosts untouched (rewriting breaks signatures).
      if (!apiOrigin || absolute.origin !== apiOrigin) {
        return trimmed;
      }
      // Same API host in dev — route /uploads through the Vite proxy.
      if (devOrigin && import.meta.env.DEV && absolute.pathname.startsWith("/uploads/")) {
        return `${devOrigin}${absolute.pathname}${absolute.search}${absolute.hash}`;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const relative = trimmed.replace(/^\/+/, "");
  const path = relative.startsWith("uploads/")
    ? `/${relative}`
    : trimmed.startsWith("/")
      ? trimmed
      : `/${relative}`;

  const origin = devOrigin ?? apiOrigin;
  if (!origin) return path;
  return `${origin}${path}`;
}

/** Same order as live: full icon first, thumbnail fallback. */
export function resolveRentalIconUrlFromPlan(plan?: {
  iconUrl?: string | null;
  iconThumbnailUrl?: string | null;
} | null): string {
  if (!plan) return "";
  const primary = resolveRentalIconUrl(plan.iconUrl);
  if (primary) return primary;
  return resolveRentalIconUrl(plan.iconThumbnailUrl);
}
