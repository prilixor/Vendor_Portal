import { apiClient } from "./apiClient";

export interface PublicLegalDocumentListItem {
  slug: string;
  documentType: string;
  title: string;
  summary?: string | null;
  publicPath?: string | null;
  sortOrder: number;
  versionNumber: number;
  effectiveFrom: string;
  lastUpdated: string;
  isRequiredToProceed: boolean;
}

export interface PublicLegalDocumentDetail extends PublicLegalDocumentListItem {
  contentHtml: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = "legal-public:";

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expires: number; value: T };
    if (!parsed?.expires || parsed.expires < Date.now() || parsed.value == null) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify({ expires: Date.now() + CACHE_TTL_MS, value }),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function listKey(surface?: string, screen?: string) {
  return `list:${surface ?? ""}:${screen ?? ""}`;
}

function detailKey(slug: string, surface?: string) {
  return `get:${slug}:${surface ?? ""}`;
}

export const publicLegalApi = {
  list: async (surface?: string, screen?: string) => {
    const key = listKey(surface, screen);
    const cached = readCache<PublicLegalDocumentListItem[]>(key);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (surface) params.set("surface", surface);
    if (screen) params.set("screen", screen);
    const query = params.toString();
    const list = await apiClient.get<PublicLegalDocumentListItem[]>(
      `/common/legal-documents${query ? `?${query}` : ""}`,
    );
    writeCache(key, list);
    return list;
  },

  peek: (slug: string, surface?: string) =>
    readCache<PublicLegalDocumentDetail>(detailKey(slug, surface))
    ?? readCache<PublicLegalDocumentDetail>(detailKey(slug)),

  get: async (slug: string, surface?: string) => {
    const cached = publicLegalApi.peek(slug, surface);
    if (cached) return cached;
    return publicLegalApi.refresh(slug, surface);
  },

  refresh: async (slug: string, surface?: string) => {
    const params = new URLSearchParams();
    if (surface) params.set("surface", surface);
    const query = params.toString();
    const detail = await apiClient.get<PublicLegalDocumentDetail>(
      `/common/legal-documents/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`,
    );
    writeCache(detailKey(slug, surface), detail);
    writeCache(detailKey(slug), detail);
    return detail;
  },

  prefetch: (slug: string, surface?: string) => {
    if (publicLegalApi.peek(slug, surface)) return;
    void publicLegalApi.refresh(slug, surface);
  },
};
