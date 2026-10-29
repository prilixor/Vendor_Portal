import {
  ADMIN_REFRESH_TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_USER_KEY,
  getActiveAccessToken,
  getActiveRefreshToken,
  IMPERSONATION_TOKEN_KEY,
  isAdminPath,
  PORTAL_REFRESH_TOKEN_KEY,
  PORTAL_TOKEN_KEY,
  PORTAL_USER_KEY,
  setAdminAccessToken,
  setPortalAccessToken,
} from "@/app/helpers/authSession";
import {
  beginPortalRequest,
  endPortalRequest,
  UnauthorizedRedirectError,
} from "@/app/helpers/portalLoader";

export type ApiClientOptions = {
  /** Background polls — do not drive the branded page overlay. */
  quiet?: boolean;
};

function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();
  if (explicit) {
    const brokenHttpOnTlsPort =
      /^http:\/\/localhost:5001\b/i.test(explicit) ||
      /^http:\/\/127\.0\.0\.1:5001\b/i.test(explicit);
    if (import.meta.env.DEV && brokenHttpOnTlsPort) {
      console.warn(
        "[apiClient] VITE_API_BASE_URL uses http on port 5001 (HTTPS port). Using dev proxy /api instead.",
      );
      return "/api";
    }
    return explicit.replace(/\/+$/, "");
  }
  return "/api";
}

const API_BASE_URL = resolveApiBaseUrl();

function usingImpersonationSession(): boolean {
  return typeof window !== "undefined"
    && !isAdminPath()
    && !!sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Renew the saved sign-in. One shared call so parallel 401s do not revoke each other. */
export function refreshStoredSession(): Promise<boolean> {
  if (usingImpersonationSession()) return Promise.resolve(false);
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = renewStoredSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function renewStoredSession(): Promise<boolean> {
  const access = getActiveAccessToken();
  const refresh = getActiveRefreshToken();
  if (!access || !refresh) return false;

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: access, refreshToken: refresh }),
  }).catch(() => null);
  if (!response?.ok) return false;

  const data = await response.json().catch(() => null) as {
    token?: string;
    refreshToken?: string;
    user?: {
      id?: string;
      email?: string;
      name?: string;
      role?: string;
      adminRole?: string;
      permissions?: string[];
    };
  } | null;
  if (!data?.token || !data.refreshToken) return false;

  if (isAdminPath()) {
    setAdminAccessToken(data.token);
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, data.refreshToken);
    const existing = readJson(ADMIN_USER_KEY);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify({
      ...existing,
      id: data.user?.id ?? existing?.id,
      email: data.user?.email ?? existing?.email,
      name: data.user?.name ?? existing?.name,
      fullName: data.user?.name ?? existing?.fullName ?? existing?.name,
      role: data.user?.adminRole || data.user?.role || existing?.role,
      adminRole: data.user?.adminRole || existing?.adminRole || existing?.role,
      permissions: data.user?.permissions ?? existing?.permissions ?? [],
    }));
  } else {
    setPortalAccessToken(data.token);
    localStorage.setItem(PORTAL_REFRESH_TOKEN_KEY, data.refreshToken);
    const existing = readJson(PORTAL_USER_KEY);
    if (data.user) {
      localStorage.setItem(PORTAL_USER_KEY, JSON.stringify({
        ...existing,
        id: data.user.id ?? existing?.id,
        email: data.user.email ?? existing?.email,
        name: data.user.name ?? existing?.name,
        role: data.user.role ?? existing?.role,
      }));
    }
  }
  return true;
}

function readJson(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Tell the server this browser's saved sign-in is finished. */
export function revokeStoredSession(): void {
  const refresh = getActiveRefreshToken();
  if (!refresh || usingImpersonationSession()) return;
  void fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Login/register/forgot-password return 401 for bad credentials — not an expired session. */
function shouldTreat401AsSessionExpiry(endpoint: string): boolean {
  const path = (endpoint.split("?")[0] ?? "").replace(/\/+$/, "").toLowerCase();
  if (
    path.includes("/auth/login") ||
    path.includes("/auth/refresh") ||
    path.includes("/auth/logout") ||
    path.includes("/auth/forgot-password") ||
    path.includes("/auth/reset-password") ||
    path.includes("/auth/verify-email") ||
    path.includes("/auth/resend-verification") ||
    path.includes("/auth/phone/") ||
    path.endsWith("/vendors/register") ||
    path.endsWith("/customers/register")
  ) {
    return false;
  }
  return true;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private getToken(): string | null {
    return getActiveAccessToken();
  }

  private setToken(token: string): void {
    // Default write path: portal token. Admin login should call setAdminAuthToken.
    if (isAdminPath()) {
      setAdminAccessToken(token);
      return;
    }
    setPortalAccessToken(token);
  }

  private clearToken(): void {
    if (isAdminPath()) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    localStorage.removeItem(PORTAL_TOKEN_KEY);
  }

  private shouldTrack(_method: string, _endpoint: string, _options?: ApiClientOptions) {
    // Never drive a full-pane loader from apiClient. That overlay caused
    // project-wide fade/vibrate on search, filter, save, and navigation.
    // Pages use PageLoaderSlot / button spinners for their own feedback.
    return false;
  }

  private async track<T>(
    method: string,
    endpoint: string,
    work: () => Promise<T>,
    options?: ApiClientOptions,
  ): Promise<T> {
    const track = this.shouldTrack(method, endpoint, options);
    if (track) beginPortalRequest();
    try {
      return await work();
    } catch (error) {
      if (error instanceof UnauthorizedRedirectError) {
        return new Promise(() => {}) as Promise<T>;
      }
      throw error;
    } finally {
      if (track) endPortalRequest();
    }
  }

  private async send<T>(
    endpoint: string,
    init: RequestInit,
    includeJson: boolean,
    retry = true,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (includeJson && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const token = this.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(this.buildUrl(endpoint), { ...init, headers });
    if (response.status === 401 && retry && shouldTreat401AsSessionExpiry(endpoint) && !usingImpersonationSession()) {
      const refreshed = await refreshStoredSession();
      if (refreshed) return this.send<T>(endpoint, init, includeJson, false);
      window.dispatchEvent(new Event("unauthorized"));
      throw new UnauthorizedRedirectError();
    }
    if (response.status === 401 && shouldTreat401AsSessionExpiry(endpoint)) {
      window.dispatchEvent(new Event("unauthorized"));
      throw new UnauthorizedRedirectError();
    }
    return this.handleResponse<T>(response, endpoint);
  }

  private async handleResponse<T>(response: Response, endpoint = ""): Promise<T> {

    if (!response.ok) {
      const parsed = await response.json().catch(() => ({ detail: "An error occurred" }));
      // FluentResults NotFound/BadRequest often returns `Error[]` ({ code, description }).
      const firstListItem =
        Array.isArray(parsed) && parsed.length > 0 && parsed[0] && typeof parsed[0] === "object"
          ? (parsed[0] as Record<string, unknown>)
          : null;
      const error =
        firstListItem ??
        (parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { detail: "An error occurred" });

      // Prefer human detail; never use technical title/code as the visible message.
      const detail = typeof error.detail === "string" ? error.detail.trim() : "";
      const title = typeof error.title === "string" ? error.title.trim() : "";
      const description =
        typeof error.description === "string" ? error.description.trim() : "";
      const rawMessage =
        (detail && !/^[a-z0-9_.-]+$/i.test(detail) ? detail : "") ||
        (description && !/^[a-z0-9_.-]+$/i.test(description) ? description : "") ||
        (typeof error.message === "string" ? String(error.message).trim() : "") ||
        "An error occurred";

      let code =
        error.code || error.errorCode || error.errorType || undefined;
      // ProblemDetails often puts the machine code in `title`
      if ((!code || String(code).includes("://")) && title && /^[a-z0-9_.-]+$/i.test(title)) {
        code = title;
      }
      if (!code || String(code).includes("http") || String(code).includes("://")) {
        const sourceText = `${detail} ${title} ${description} ${rawMessage}`;
        const codeMatch = sourceText.match(
          /(vendors\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|customers\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|admins\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|documents\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|bank_accounts\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|auth\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|directory\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|phone\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|EMAIL_NOT_VERIFIED)/i,
        );
        if (codeMatch) code = codeMatch[1];
      }

      // Throw clean message only — never append [error.code] for UI display.
      // Attach code so getUserFriendlyMessage can map it.
      const err = new Error(rawMessage) as Error & { code?: string; status?: number };
      if (code) err.code = String(code);
      err.status = response.status;
      throw err;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    
    return JSON.parse(text);
  }

  private buildUrl(endpoint: string): string {
    // If endpoint is already an absolute URL (starts with http:// or https://), use it as-is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    return `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }

  async get<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.track("GET", endpoint, () => this.send<T>(endpoint, { method: "GET" }, false), options);
  }

  async post<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "POST",
      endpoint,
      () => this.send<T>(endpoint, { method: "POST", body: data ? JSON.stringify(data) : undefined }, true),
      options,
    );
  }

  async put<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "PUT",
      endpoint,
      () => this.send<T>(endpoint, { method: "PUT", body: data ? JSON.stringify(data) : undefined }, true),
      options,
    );
  }

  async patch<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "PATCH",
      endpoint,
      () => this.send<T>(
        endpoint,
        { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined },
        data !== undefined,
      ),
      options,
    );
  }

  async delete<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.track("DELETE", endpoint, () => this.send<T>(endpoint, { method: "DELETE" }, false), options);
  }

  async postForm<T>(endpoint: string, data: FormData, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "POST",
      endpoint,
      () => this.send<T>(endpoint, { method: "POST", body: data }, false),
      options,
    );
  }

  setAuthToken(token: string): void {
    this.setToken(token);
  }

  setAdminAuthToken(token: string): void {
    setAdminAccessToken(token);
  }

  removeAuthToken(): void {
    this.clearToken();
  }

  hasAuthToken(): boolean {
    return this.getToken() !== null;
  }

  async downloadBlob(endpoint: string, filename: string): Promise<void> {
    const blob = await this.fetchBlob(endpoint);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async fetchBlob(endpoint: string, options?: ApiClientOptions, retry = true): Promise<Blob> {
    return this.track(
      "GET",
      endpoint,
      async () => {
        const token = this.getToken();
        const headers: HeadersInit = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(this.buildUrl(endpoint.startsWith("/") ? endpoint : `/${endpoint}`), {
          method: "GET",
          headers,
        });

        if (response.status === 401 && retry && shouldTreat401AsSessionExpiry(endpoint) && !usingImpersonationSession()) {
          const refreshed = await refreshStoredSession();
          if (refreshed) return this.fetchBlob(endpoint, options, false);
          window.dispatchEvent(new Event("unauthorized"));
          throw new UnauthorizedRedirectError();
        }
        if (response.status === 401) {
          window.dispatchEvent(new Event("unauthorized"));
          throw new UnauthorizedRedirectError();
        }

        if (!response.ok) {
          throw new Error(`Download failed: ${response.statusText}`);
        }

        return response.blob();
      },
      options,
    );
  }
}

export const apiClient = new ApiClient();
