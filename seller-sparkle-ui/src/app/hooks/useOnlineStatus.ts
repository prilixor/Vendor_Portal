import { useEffect, useState, useCallback } from "react";

/**
 * Tracks browser online/offline. `navigator.onLine` is the primary signal;
 * we also listen to window events (real-world: Wi‑Fi toggle, airplane mode).
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const refresh = useCallback(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Sync in case status changed before listeners attached.
    refresh();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refresh]);

  return { isOnline, refresh };
}
