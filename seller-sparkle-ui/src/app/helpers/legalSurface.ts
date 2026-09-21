import { getPortalHostKind } from "@/app/helpers/portalHost";

export type LegalWebSurface = "customer_web" | "vendor_web" | "admin_web";

export function legalSurfaceForRegister(role: "customer" | "vendor"): LegalWebSurface {
  return role === "vendor" ? "vendor_web" : "customer_web";
}

/** Surface for public legal pages and footers. Localhost uses path/query hints. */
export function resolveLegalSurface(prefer?: "customer" | "vendor"): LegalWebSurface | undefined {
  const host = getPortalHostKind();
  if (host === "vendor") return "vendor_web";
  if (host === "customer") return "customer_web";
  if (host === "admin") return "admin_web";

  if (prefer === "vendor") return "vendor_web";
  if (prefer === "customer") return "customer_web";

  if (typeof window === "undefined") return undefined;
  const portal = new URLSearchParams(window.location.search).get("portal")?.toLowerCase();
  if (portal === "vendor") return "vendor_web";
  if (portal === "customer") return "customer_web";

  const path = window.location.pathname;
  if (path.startsWith("/customer")) return "customer_web";
  if (
    path.startsWith("/vendor")
    || path === "/register"
    || path === "/login"
    || path === "/vendor-seller-policy"
  ) {
    return "vendor_web";
  }
  return undefined;
}

export function legalHref(doc: { publicPath?: string | null; slug: string }): string {
  if (doc.publicPath && doc.publicPath.startsWith("/")) return doc.publicPath;
  if (doc.slug === "terms-of-use") return "/terms-and-conditions";
  if (doc.slug === "privacy-policy") return "/privacy-policy";
  return `/${doc.slug}`;
}
