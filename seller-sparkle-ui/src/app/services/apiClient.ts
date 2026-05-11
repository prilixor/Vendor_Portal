const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:7257/api";

const TOKEN_KEY = 'vendor_portal_token';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
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

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
      const message = error.detail || error.title || error.message || 'An error occurred';
      // Look for error code in various fields, but skip URL-like values (RFC links)
      let code = error.code || error.errorCode || error.errorType;
      // If code looks like a URL (contains http), search in other fields or message
      if (!code || code.includes('http') || code.includes('://') || code.startsWith('https')) {
        // Try to extract from error.message or error.title
        const sourceText = error.message || error.title || message;
        const codeMatch = sourceText.match(/(vendors\.[a-z_]+|admins\.[a-z_]+|documents\.[a-z_]+|bank_accounts\.[a-z_]+)/i);
        if (codeMatch) {
          code = codeMatch[1];
        }
      }
      // Include code in message so getUserFriendlyMessage can extract it
      const fullMessage = code ? `${message} [${code}]` : message;
      throw new Error(fullMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private buildUrl(endpoint: string): string {
    // If endpoint is already an absolute URL (starts with http:// or https://), use it as-is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    return `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'GET',
      headers: this.getHeaders(false),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'POST',
      headers: this.getHeaders(true),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const hasBody = data !== undefined;
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'PATCH',
      headers: this.getHeaders(hasBody),
      body: hasBody ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: 'DELETE',
      headers: this.getHeaders(false),
    });

    return this.handleResponse<T>(response);
  }

  async postForm<T>(endpoint: string, data: FormData): Promise<T> {
    const response = await fetch(this.buildUrl(endpoint), {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: data,
    });

    return this.handleResponse<T>(response);
  }

  setAuthToken(token: string): void {
    this.setToken(token);
  }

  removeAuthToken(): void {
    this.clearToken();
  }

  hasAuthToken(): boolean {
    return this.getToken() !== null;
  }

  async downloadBlob(endpoint: string, filename: string): Promise<void> {
    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const apiClient = new ApiClient();
