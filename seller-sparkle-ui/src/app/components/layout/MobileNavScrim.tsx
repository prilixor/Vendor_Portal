import { useLayoutEffect } from "react";
import { cn } from "@/app/helpers/utils";

/** True when the gesture is on the drawer and that drawer can still scroll this way. */
function drawerCanScroll(target: EventTarget | null, deltaY: number): boolean {
  if (!(target instanceof Element) || deltaY === 0) return false;
  const drawer = target.closest("[data-app-drawer]");
  if (!drawer) return false;

  let node: Element | null = target;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const scrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      const roomBelow = node.scrollHeight - node.clientHeight - node.scrollTop;
      if (deltaY > 0 ? roomBelow > 1 : node.scrollTop > 0) return true;
    }
    if (node === drawer) break;
    node = node.parentElement;
  }
  return false;
}

/**
 * Freeze the page behind an open mobile menu, and close that menu on Escape
 * or when the viewport reaches desktop.
 *
 * `overflow-x: clip` on `html` means the viewport scroller is the document
 * element. Hiding overflow on `body` alone leaves that page free to move.
 */
export function useMobileNavLock(open: boolean, onClose: () => void, desktopQuery = "(min-width: 1024px)") {
  useLayoutEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const scrollY = window.scrollY;
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);

    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      rootOverflow: root?.style.overflow ?? "",
      rootOverscroll: root?.style.overscrollBehavior ?? "",
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
    if (root) {
      root.style.overflow = "hidden";
      root.style.overscrollBehavior = "none";
    }

    const stopPageScroll = (deltaY: number, event: Event) => {
      if (drawerCanScroll(event.target, deltaY)) return;
      event.preventDefault();
    };
    const onWheel = (event: WheelEvent) => stopPageScroll(event.deltaY, event);

    let touchStartY = 0;
    let dragging = false;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
      dragging = false;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = touchStartY - y;
      if (!dragging && Math.abs(deltaY) < 8) return;
      dragging = true;
      stopPageScroll(deltaY, event);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const media = window.matchMedia(desktopQuery);
    const onBreakpoint = () => {
      if (media.matches) onClose();
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onBreakpoint);

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.paddingRight = previous.bodyPaddingRight;
      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.overscrollBehavior = previous.rootOverscroll;
      }
      window.scrollTo(0, scrollY);

      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onBreakpoint);
    };
  }, [open, onClose, desktopQuery]);
}

/** Full-screen click catcher so page controls behind an open mobile menu cannot be used. */
export function MobileNavScrim({
  open,
  onClose,
  className,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  if (!open) return null;

  return (
    <button
      type="button"
      aria-label="Close menu"
      className={cn(
        "fixed inset-0 z-40 h-[100dvh] w-screen cursor-default bg-black/50 pointer-events-auto touch-none overscroll-none",
        className,
      )}
      onClick={onClose}
    />
  );
}
