import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a string to camel case (title case)
 * Example: "john doe" -> "John Doe", "ACME corp" -> "Acme Corp"
 */
export function toCamelCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** If a thumbnail URL 404s locally, the original file is usually still on disk. */
export function originalUrlFromThumb(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed) return null;
  const next = trimmed.replace(/_thumb(\.[a-z0-9]+)(?:[?#].*)?$/i, "$1");
  return next !== trimmed ? next : null;
}

/** Live thumbs succeed so this is a no-op; locally it swaps `_thumb` to the original file. */
export function retryOriginalOnImageError(event: { currentTarget: HTMLImageElement }): void {
  const el = event.currentTarget;
  if (el.dataset.thumbFallback === "1") return;
  const next = originalUrlFromThumb(el.currentSrc || el.src);
  if (!next) return;
  el.dataset.thumbFallback = "1";
  el.src = next;
}

/** Collect display URLs: primary, original if primary is a _thumb, then extras. Live thumbs succeed so extras are unused. */
export function imageSrcCandidates(
  primary?: string | null,
  extra?: string | null,
): string[] {
  const out: string[] = [];
  const add = (raw?: string | null) => {
    const url = raw?.trim();
    if (!url || out.includes(url)) return;
    out.push(url);
    const original = originalUrlFromThumb(url);
    if (original && !out.includes(original)) out.push(original);
  };
  add(primary);
  add(extra);
  return out;
}

/** Resolve product/order avatar URL across DTO naming variants. Prefers thumbnail when present (same as live). */
export function resolveItemImageUrl(
  item?: {
    listingPrimaryImageUrl?: string | null;
    primaryImageUrl?: string | null;
    primaryThumbnailUrl?: string | null;
    thumbnailUrl?: string | null;
    imageUrls?: string[] | null;
  } | null,
): string | null {
  if (!item) return null;
  const fromThumb =
    item.primaryThumbnailUrl?.trim() ||
    item.thumbnailUrl?.trim();
  if (fromThumb) return fromThumb;
  const fromListing = item.listingPrimaryImageUrl?.trim();
  if (fromListing) return fromListing;
  const fromPrimary = item.primaryImageUrl?.trim();
  if (fromPrimary) return fromPrimary;
  const fromGallery = item.imageUrls?.find((u) => u?.trim());
  return fromGallery?.trim() || null;
}

/** Pick a list-row thumbnail from catalog product images (primary first). */
export function resolveCatalogProductImageUrl(
  images?: Array<{
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    isPrimary?: boolean;
    displayOrder?: number;
  }> | null,
): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => {
    const primaryDelta = Number(!!b.isPrimary) - Number(!!a.isPrimary);
    if (primaryDelta !== 0) return primaryDelta;
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });
  const primary = sorted[0];
  return resolveItemImageUrl({
    primaryImageUrl: primary.imageUrl,
    thumbnailUrl: primary.thumbnailUrl,
  });
}
