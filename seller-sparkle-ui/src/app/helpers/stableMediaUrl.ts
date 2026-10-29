import { useRef } from "react";

const REFRESH_BEFORE_MS = 60_000;

/** Path of a stored file. A new S3 signature does not change this. */
export function mediaObjectKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    return decodeURIComponent(new URL(trimmed, "https://blinksmed.local").pathname);
  } catch {
    return trimmed.split("?")[0];
  }
}

function signedUrlExpiresAt(url: string): number | null {
  try {
    const params = new URL(url, "https://blinksmed.local").searchParams;
    const stamp = params.get("X-Amz-Date");
    const expires = Number(params.get("X-Amz-Expires"));
    if (!stamp || !Number.isFinite(expires)) return null;
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(stamp);
    if (!match) return null;
    const start = Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    );
    return start + expires * 1000;
  } catch {
    return null;
  }
}

function keepStableMediaUrl(previous: string | undefined, next: string, now: number): string {
  if (!previous) return next;
  if (mediaObjectKey(previous) !== mediaObjectKey(next)) return next;
  const expiry = signedUrlExpiresAt(previous);
  if (expiry == null || now < expiry - REFRESH_BEFORE_MS) return previous;
  return next;
}

/** Keep the photo address already on screen when a poll only refreshes the signature. */
export function stabilizeMediaUrls(previous: readonly string[], next: readonly string[], now = Date.now()): string[] {
  const previousByKey = new Map<string, string>();
  for (const url of previous) previousByKey.set(mediaObjectKey(url), url);
  return next.map((url) => keepStableMediaUrl(previousByKey.get(mediaObjectKey(url)), url, now));
}

export function useStableMediaUrls(urls: readonly string[]): string[] {
  const kept = useRef<string[]>([]);
  const stable = stabilizeMediaUrls(kept.current, urls);
  kept.current = stable;
  return stable;
}
