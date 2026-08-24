export const BRAND_MARK_SRC = "/branding/blinksmed-mark.png";
export const BRAND_LOGO_SRC = "/branding/blinksmed-logo.png";
/** Unique path + version so Chrome does not keep serving the old Lovable /favicon.ico cache. */
export const FAVICON_HREF = "/bm-icon.png?v=20260821bm";

const ready = new Set<string>();
const waiters = new Set<() => void>();

function notify() {
  waiters.forEach((listener) => listener());
}

function decodeSrc(src: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  const markReady = () => {
    if (img.naturalWidth <= 0) return;
    ready.add(src);
    notify();
  };
  img.addEventListener("load", markReady, { once: true });
  void img.decode?.().then(markReady).catch(() => {
    // Keep the load listener; a decode() reject should not block the cached bitmap.
  });
}

/** Warm both lockups as soon as JS starts so the loader never paints an empty plate. */
export function preloadBrandArt() {
  decodeSrc(BRAND_MARK_SRC);
  decodeSrc(BRAND_LOGO_SRC);
}

/** Replace leftover Lovable / cached origin icons with the BlinksMed mark. */
export function applyFavicon() {
  if (typeof document === "undefined") return;
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
  links.forEach((el) => el.remove());
  const png = document.createElement("link");
  png.rel = "icon";
  png.type = "image/png";
  png.sizes = "32x32";
  png.href = FAVICON_HREF;
  document.head.appendChild(png);
}

export function brandArtSrc(artwork: "mark" | "logo") {
  return artwork === "logo" ? BRAND_LOGO_SRC : BRAND_MARK_SRC;
}

export function isBrandArtReady(artwork: "mark" | "logo") {
  return ready.has(brandArtSrc(artwork));
}

export function subscribeBrandArt(listener: () => void) {
  waiters.add(listener);
  return () => {
    waiters.delete(listener);
  };
}
