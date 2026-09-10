import { useQuery } from "@tanstack/react-query";
import {
  websiteContentApi,
  type FullWebsiteContentDto,
} from "@/app/services/websiteContentApi";

export const PUBLIC_WEBSITE_CONTENT_QUERY_KEY = ["publicWebsiteContent"] as const;
const CACHE_KEY = "bm-public-website-content-v1";

export function readCachedPublicContent(): FullWebsiteContentDto | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as FullWebsiteContentDto;
  } catch {
    return undefined;
  }
}

export function writeCachedPublicContent(data: FullWebsiteContentDto) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function preloadHeroImage(url?: string | null) {
  if (!url || typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

export function usePublicWebsiteContent() {
  return useQuery({
    queryKey: PUBLIC_WEBSITE_CONTENT_QUERY_KEY,
    queryFn: async () => {
      const fresh = await websiteContentApi.getPublicContent();
      writeCachedPublicContent(fresh);
      const slides = (fresh.home?.heroSlides ?? []).filter((s) => s.imageUrl);
      slides.forEach((slide) => preloadHeroImage(slide.imageUrl));
      return fresh;
    },
    placeholderData: (previous) => previous ?? readCachedPublicContent(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
