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
