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
      throw new Error(error.detail || error.title || 'An error occurred');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  private buildUrl(endpoint: string): string {
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
}

export const apiClient = new ApiClient();
