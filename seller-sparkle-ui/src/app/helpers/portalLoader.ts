import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Skip the overlay when the request finishes almost immediately. */
export const PORTAL_LOADER_SHOW_DELAY_MS = 180;
/** Once shown, keep it on long enough that the animation does not flicker. */
export const PORTAL_LOADER_MIN_VISIBLE_MS = 400;

let inflight = 0;
const listeners = new Set<() => void>();

function emitInflight() {
  listeners.forEach((listener) => listener());
}

export function beginPortalRequest() {
  inflight += 1;
  emitInflight();
}

export function endPortalRequest() {
  inflight = Math.max(0, inflight - 1);
  emitInflight();
}

export function getPortalInflightCount() {
  return inflight;
}

export function subscribePortalInflight(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Thrown on 401 so inflight tracking can finish before the hang-redirect. */
export class UnauthorizedRedirectError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedRedirectError";
  }
}

/**
 * Badge / shell / chat polls that share a GET with a page, or run on every
 * vendor screen (support FAB). First paint of those pages is covered by
 * React Query (`data === undefined`).
 */
export function isQuietPortalGet(endpoint: string): boolean {
  const path = (endpoint.split("?")[0] ?? "").replace(/\/+$/, "").toLowerCase() || "/";

  if (path.includes("unread-count")) return true;
  if (path === "/admin/orders/continuations/pending") return true;
  if (path === "/admin/chats/sessions") return true;
  if (path === "/customers/me/chats/sessions") return true;

  if (/^\/vendors\/[^/]+$/.test(path)) return true;
  if (/^\/vendors\/[^/]+\/documents$/.test(path)) return true;
  if (/^\/vendors\/[^/]+\/bank-accounts$/.test(path)) return true;
  if (/^\/vendors\/[^/]+\/chats\/sessions$/.test(path)) return true;
  if (/^\/support\/tickets\/vendor\/[^/]+$/.test(path)) return true;
  if (/^\/admin\/vendors\/[^/]+\/documents$/.test(path)) return true;

  if (
    /\/messages$/.test(path) &&
    (path.includes("/chats/") || path.includes("/support/tickets/"))
  ) {
    return true;
  }

  return false;
}

/** AppShell (or a page that renders its own branded loader) already mounts an overlay. */
export function hasEmbeddedPortalLoader(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/impersonation/consume") return true;
  if (p === "/customer/login" || p === "/customer/register") return false;
  if (p === "/admin/login" || p === "/admin/register") return false;
  return p.startsWith("/customer") || p.startsWith("/vendor") || p.startsWith("/admin");
}

export function usePortalApiInflight() {
  return useSyncExternalStore(
    subscribePortalInflight,
    () => getPortalInflightCount() > 0,
    () => false,
  );
}

export function useIdealLoaderVisible(pending: boolean) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    if (pending) {
      if (!visible) {
        showTimer = window.setTimeout(() => {
          shownAtRef.current = Date.now();
          setVisible(true);
        }, PORTAL_LOADER_SHOW_DELAY_MS);
      }
    } else if (visible) {
      const elapsed = Date.now() - (shownAtRef.current ?? Date.now());
      hideTimer = window.setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, Math.max(0, PORTAL_LOADER_MIN_VISIBLE_MS - elapsed));
    }

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [pending, visible]);

  return visible;
}
