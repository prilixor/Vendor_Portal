export function slugFromName(name?: string | null): string {
  const slug = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .replace(/_+$/g, "");
  return slug || "icon";
}

export function rentalValueTierLabel(tier?: string | null): string {
  const key = (tier ?? "").toLowerCase().replace(/-/g, "_");
  const known: Record<string, string> = {
    good: "Good",
    better: "Better",
    best_value: "Best Value",
    maximum_savings: "Maximum Savings",
  };
  if (known[key]) return known[key];
  if (!key) return "";
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function rentalIconLabel(plan?: {
  iconName?: string | null;
  valueTier?: string | null;
} | null): string {
  const name = plan?.iconName?.trim();
  if (name) return name;
  return rentalValueTierLabel(plan?.valueTier);
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
