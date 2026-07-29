import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

/**
 * Global offline bar for Customer / Vendor / Admin web.
 * Non-blocking: users can still view already-loaded content; Retry reloads when back online.
 */
export function OfflineBanner() {
  const { isOnline, refresh } = useOnlineStatus();

  if (isOnline) return null;

  const handleRetry = () => {
    refresh();
    if (navigator.onLine) {
      window.location.reload();
      return;
    }
    refresh();
  };

  return (
    <>
      {/* Fixed bar so it stays visible over all portal shells */}
      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-x-0 top-0 z-[200] border-b border-amber-700/40 bg-amber-950 text-amber-50 shadow-md"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-200 sm:mt-0" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">No internet connection</p>
              <p className="text-xs text-amber-100/80 leading-snug">
                Please check your network and try again. Some actions won&apos;t work until you&apos;re back
                online.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleRetry}
            className="shrink-0 bg-amber-100 text-amber-950 hover:bg-white"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
      {/* Spacer so page content is not hidden under the fixed bar */}
      <div className="h-[58px] sm:h-[52px]" aria-hidden />
    </>
  );
}
