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

/** Resolve product/order avatar URL across DTO naming variants. Prefers thumbnail when present. */
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
