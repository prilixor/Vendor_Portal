import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import { PageLoader } from "@/app/components/shared/PageLoader";
import { cn } from "@/app/helpers/utils";
import {
  hasEmbeddedPortalLoader,
  useIdealLoaderVisible,
  usePortalApiInflight,
} from "@/app/helpers/portalLoader";

/** Shell/badge polls — never flash the page loader on these. */
const BACKGROUND_QUERY_HEADS = new Set([
  "admin-customer-chat-unread",
  "admin-vendor-support-unread",
  "admin-customer-chat-messages",
  "chat-messages",
  "customer-notifications",
]);

function isPortalPageLoad(query: {
  queryKey: readonly unknown[];
  state: { data: unknown; fetchStatus: string };
}) {
  const head = query.queryKey[0];
  if (typeof head === "string" && BACKGROUND_QUERY_HEADS.has(head)) return false;
  return query.state.data === undefined && query.state.fetchStatus === "fetching";
}

function usePortalLoaderVisible() {
  const queryPending = useIsFetching({ predicate: isPortalPageLoad }) > 0;
  const apiPending = usePortalApiInflight();
  return useIdealLoaderVisible(queryPending || apiPending);
}

type OverlayPlacement = "chrome" | "main" | "full";

type VisiblePane = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function readVisiblePane(el: HTMLElement): VisiblePane | null {
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewRight = viewLeft + (vv?.width ?? window.innerWidth);
  const viewBottom = viewTop + (vv?.height ?? window.innerHeight);

  const top = Math.max(viewTop, rect.top);
  const left = Math.max(viewLeft, rect.left);
  const right = Math.min(viewRight, rect.right);
  const bottom = Math.min(viewBottom, rect.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width < 8 || height < 8) return null;
  return { top, left, width, height };
}

/**
 * Pin the overlay to the visible slice of <main>, not the full document height.
 * Long dashboards otherwise center the loader in the middle of the scroll height.
 */
function useVisibleMainPane(active: boolean) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState<VisiblePane | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setPane(null);
      return;
    }

    const host = hostRef.current;
    const paneEl = host?.closest("main") ?? host;
    if (!paneEl) return;

    const update = () => setPane(readVisiblePane(paneEl));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(paneEl);

    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [active]);

  return { hostRef, pane };
}

function paneStyle(pane: VisiblePane): CSSProperties {
  return {
    top: pane.top,
    left: pane.left,
    width: pane.width,
    height: pane.height,
  };
}

type PortalLoaderOverlayProps = {
  placement: OverlayPlacement;
};

/** Branded overlay. No per-page text. Always centered in the visible pane. */
export function PortalLoaderOverlay({ placement }: PortalLoaderOverlayProps) {
  const showLoader = usePortalLoaderVisible();
  const pinToMain = showLoader && placement === "main";
  const { hostRef, pane } = useVisibleMainPane(pinToMain);

  if (!showLoader) return null;

  const mark = <PageLoader className="min-h-0 py-0" />;

  if (placement === "main") {
    return (
      <>
        <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />
        {pane && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed z-20 flex items-center justify-center bg-background/55 backdrop-blur-[3px]"
                data-portal-loader="true"
                style={paneStyle(pane)}
              >
                {mark}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <div
      className={cn(
        "z-20 flex items-center justify-center bg-background/55 backdrop-blur-[3px]",
        placement === "full" && "fixed inset-0 z-[60]",
        placement === "chrome" && "fixed inset-x-0 bottom-0 top-14 z-30 sm:top-16",
      )}
      data-portal-loader="true"
    >
      {mark}
    </div>
  );
}

type PortalGlobalLoaderProps = {
  /** `chrome` = below customer header. `main` = inside vendor/admin content pane. */
  placement: "chrome" | "main";
};

/** Branded loader for Customer, Vendor, and Admin AppShell pages. */
export function PortalGlobalLoader({ placement }: PortalGlobalLoaderProps) {
  return (
    <>
      <Outlet />
      <PortalLoaderOverlay placement={placement} />
    </>
  );
}

/** Auth, landing, legal, and public pages that are not inside AppShell. */
export function StandalonePortalLoader() {
  const { pathname } = useLocation();
  if (hasEmbeddedPortalLoader(pathname)) return null;
  return <PortalLoaderOverlay placement="full" />;
}
