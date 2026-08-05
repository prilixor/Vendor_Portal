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

const getUploadsOrigin = (): string | null => {
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

  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }

  return null;
};

/** Resolve stored upload refs / relative paths for rental icons. */
export function resolveRentalIconUrl(fileUrl?: string | null): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("data:")) return fileUrl;

  const relative = fileUrl.replace(/^\/+/, "");
  const path = relative.startsWith("uploads/")
    ? `/${relative}`
    : fileUrl.startsWith("/")
      ? fileUrl
      : `/${relative}`;

  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const absolute = new URL(fileUrl);
      if (absolute.pathname.includes("/uploads/")) {
        const origin = getUploadsOrigin();
        if (origin && absolute.origin !== origin && import.meta.env.DEV) {
          return `${origin}${absolute.pathname}${absolute.search}${absolute.hash}`;
        }
      }
      return fileUrl;
    } catch {
      return fileUrl;
    }
  }

  const origin = getUploadsOrigin();
  if (!origin) return path;
  return `${origin}${path}`;
}
