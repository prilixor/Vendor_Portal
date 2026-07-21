/** Portal host detection for Option 2 subdomains (blinksmed.com). */
export type PortalHostKind = "admin" | "vendor" | "customer" | "local";

export function getPortalHostKind(
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): PortalHostKind {
  const host = hostname.trim().toLowerCase();
  if (host.startsWith("admin.")) return "admin";
  if (host.startsWith("vendor.")) return "vendor";
  if (host === "blinksmed.com" || host === "www.blinksmed.com") return "customer";
  return "local";
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Absolute vendor URL on customer/admin hosts; same-origin path on vendor/local. */
export function getVendorPortalHref(path = "/login"): string {
  const kind = getPortalHostKind();
  const normalized = normalizePath(path);
  if (kind === "local" || kind === "vendor") return normalized;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  return `${protocol}//vendor.blinksmed.com${normalized}`;
}

/** Absolute customer URL on vendor/admin hosts; same-origin path on customer/local. */
export function getCustomerPortalHref(path = "/customer/shop"): string {
  const kind = getPortalHostKind();
  const normalized = normalizePath(path);
  if (kind === "local" || kind === "customer") return normalized;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  return `${protocol}//www.blinksmed.com${normalized}`;
}

/** Absolute admin URL on vendor/customer hosts; same-origin path on admin/local. */
export function getAdminPortalHref(path = "/admin"): string {
  const kind = getPortalHostKind();
  const normalized = normalizePath(path);
  if (kind === "local" || kind === "admin") return normalized;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "https:";
  return `${protocol}//admin.blinksmed.com${normalized}`;
}
