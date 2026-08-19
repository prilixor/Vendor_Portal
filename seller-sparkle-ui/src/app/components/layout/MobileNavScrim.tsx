import { useEffect } from "react";
import { cn } from "@/app/helpers/utils";

/** Lock scroll and close the mobile nav on Escape or when the viewport reaches desktop. */
export function useMobileNavLock(open: boolean, onClose: () => void, desktopQuery = "(min-width: 1024px)") {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const media = window.matchMedia(desktopQuery);
    const onBreakpoint = () => {
      if (media.matches) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = previousOverflow;
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
        "fixed inset-0 z-40 h-[100dvh] w-screen cursor-default bg-black/50 pointer-events-auto",
        className,
      )}
      onClick={onClose}
    />
  );
}
