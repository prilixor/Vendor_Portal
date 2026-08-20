export const BRAND_MARK_SRC = "/branding/blinksmed-mark.png";
export const BRAND_LOGO_SRC = "/branding/blinksmed-logo.png";

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
