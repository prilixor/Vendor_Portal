import { Outlet, useLocation } from "react-router-dom";
import { hasEmbeddedPortalLoader } from "@/app/helpers/portalLoader";

/**
 * Shell outlet wrapper. The old full-pane branded overlay (bg + blur) fired on
 * every API GET and made Admin/Vendor/Customer pages fade/vibrate on search,
 * save, and filter. Pages use in-flow PageLoaderSlot / button spinners instead.
 */
export function PortalGlobalLoader(_props: { placement: "chrome" | "main" }) {
  return <Outlet />;
}

/** Auth/landing routes — no full-pane API overlay (same reason as AppShell). */
export function StandalonePortalLoader() {
  const { pathname } = useLocation();
  if (hasEmbeddedPortalLoader(pathname)) return null;
  return null;
}
