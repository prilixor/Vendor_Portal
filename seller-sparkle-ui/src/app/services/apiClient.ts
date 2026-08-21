import {
  getActiveAccessToken,
  isAdminPath,
  setAdminAccessToken,
  setPortalAccessToken,
  ADMIN_TOKEN_KEY,
  PORTAL_TOKEN_KEY,
} from "@/app/helpers/authSession";
import {
  beginPortalRequest,
  endPortalRequest,
  isQuietPortalGet,
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

/** Login/register/forgot-password return 401 for bad credentials — not an expired session. */
function shouldTreat401AsSessionExpiry(endpoint: string): boolean {
  const path = (endpoint.split("?")[0] ?? "").replace(/\/+$/, "").toLowerCase();
  if (
    path.endsWith("/auth/login") ||
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

  private getHeaders(includeJsonContentType: boolean = true): HeadersInit {
    const token = this.getToken();
    const headers: HeadersInit = {};

    if (includeJsonContentType) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private shouldTrack(method: string, endpoint: string, options?: ApiClientOptions) {
    if (options?.quiet) return false;
    if (method === "GET" && isQuietPortalGet(endpoint)) return false;
    return true;
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

  private async handleResponse<T>(response: Response, endpoint = ""): Promise<T> {
    if (response.status === 401 && shouldTreat401AsSessionExpiry(endpoint)) {
      window.dispatchEvent(new Event('unauthorized'));
      throw new UnauthorizedRedirectError();
    }

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
          /(vendors\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|customers\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|admins\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|documents\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|bank_accounts\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|auth\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|directory\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|EMAIL_NOT_VERIFIED)/i,
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
    return this.track(
      "GET",
      endpoint,
      async () => {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "GET",
          headers: this.getHeaders(false),
        });
        return this.handleResponse<T>(response, endpoint);
      },
      options,
    );
  }

  async post<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "POST",
      endpoint,
      async () => {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "POST",
          headers: this.getHeaders(true),
          body: data ? JSON.stringify(data) : undefined,
        });
        return this.handleResponse<T>(response, endpoint);
      },
      options,
    );
  }

  async put<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "PUT",
      endpoint,
      async () => {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "PUT",
          headers: this.getHeaders(true),
          body: data ? JSON.stringify(data) : undefined,
        });
        return this.handleResponse<T>(response, endpoint);
      },
      options,
    );
  }

  async patch<T>(endpoint: string, data?: unknown, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "PATCH",
      endpoint,
      async () => {
        const hasBody = data !== undefined;
        const response = await fetch(this.buildUrl(endpoint), {
          method: "PATCH",
          headers: this.getHeaders(hasBody),
          body: hasBody ? JSON.stringify(data) : undefined,
        });
        return this.handleResponse<T>(response, endpoint);
      },
      options,
    );
  }

  async delete<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "DELETE",
      endpoint,
      async () => {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "DELETE",
          headers: this.getHeaders(false),
        });
        return this.handleResponse<T>(response, endpoint);
      },
      options,
    );
  }

  async postForm<T>(endpoint: string, data: FormData, options?: ApiClientOptions): Promise<T> {
    return this.track(
      "POST",
      endpoint,
      async () => {
        const response = await fetch(this.buildUrl(endpoint), {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: data,
        });
        return this.handleResponse<T>(response, endpoint);
      },
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

  async fetchBlob(endpoint: string, options?: ApiClientOptions): Promise<Blob> {
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
