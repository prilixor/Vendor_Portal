import { useEffect } from "react";

/** Remove the HTML first-paint splash so it never stacks on the React loader. */
export function dismissBootSplash() {
  document.getElementById("boot-splash")?.remove();
}

/** Always-mounted: drops the HTML splash even when BrandBootSplash is not shown. */
export function BootSplashDismiss() {
  useEffect(() => {
    dismissBootSplash();
  }, []);
  return null;
}
