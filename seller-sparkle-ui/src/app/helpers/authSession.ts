/** Shared auth storage keys and helpers for admin / portal / impersonation sessions. */

export const ADMIN_USER_KEY = "adminUser";
export const ADMIN_TOKEN_KEY = "admin_portal_token";
export const PORTAL_USER_KEY = "vendor_portal_user";
export const PORTAL_TOKEN_KEY = "vendor_portal_token";
export const PORTAL_REFRESH_TOKEN_KEY = "vendor_portal_refresh_token";

/** Tab-scoped impersonation (does not disturb admin localStorage in other tabs). */
export const IMPERSONATION_TOKEN_KEY = "impersonation_token";
export const IMPERSONATION_USER_KEY = "impersonation_user";
export const IMPERSONATION_META_KEY = "impersonation_meta";

export function isAdminPath(pathname: string = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  return pathname.startsWith("/admin");
}

export function getActiveAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const impersonationToken = sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
  if (impersonationToken && !isAdminPath()) {
    return impersonationToken;
  }

  if (isAdminPath()) {
    ensureAdminTokenMigrated();
    return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(PORTAL_TOKEN_KEY);
  }

  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setAdminAccessToken(token: string): void {
  // Admin token must stay separate from portal/impersonation tokens (shared origin / localStorage).
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

/** One-time migration for sessions that only stored the admin JWT under the portal key. */
export function ensureAdminTokenMigrated(): void {
  if (typeof window === "undefined") return;
  if (!isAdminPath()) return;
  if (!localStorage.getItem(ADMIN_USER_KEY)) return;
  if (localStorage.getItem(ADMIN_TOKEN_KEY)) return;
  const legacy = localStorage.getItem(PORTAL_TOKEN_KEY);
  if (legacy) {
    localStorage.setItem(ADMIN_TOKEN_KEY, legacy);
  }
}

export function setPortalAccessToken(token: string): void {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function setImpersonationSession(input: {
  token: string;
  user: { id: string; email: string; name: string; role: "vendor" | "customer" };
}): void {
  sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, input.token);
  sessionStorage.setItem(
    IMPERSONATION_USER_KEY,
    JSON.stringify({
      ...input.user,
      impersonation: true,
    }),
  );
  sessionStorage.setItem(
    IMPERSONATION_META_KEY,
    JSON.stringify({
      targetType: input.user.role,
      targetName: input.user.name,
      startedAt: new Date().toISOString(),
    }),
  );
  // Clear any legacy localStorage impersonation leftovers from older builds.
  localStorage.removeItem(IMPERSONATION_META_KEY);
}

export function clearImpersonationSession(): void {
  sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  sessionStorage.removeItem(IMPERSONATION_USER_KEY);
  sessionStorage.removeItem(IMPERSONATION_META_KEY);
  localStorage.removeItem(IMPERSONATION_META_KEY);
}

export function readImpersonationUser<T = Record<string, unknown>>(): T | null {
  const raw = sessionStorage.getItem(IMPERSONATION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function clearPortalSession(): void {
  localStorage.removeItem(PORTAL_USER_KEY);
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  localStorage.removeItem(PORTAL_REFRESH_TOKEN_KEY);
}
