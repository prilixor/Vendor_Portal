import { apiClient } from './apiClient';
import { User, Role } from '@/app/models';

export interface LoginRequest {
  email: string;
  password: string;
  role: 'vendor' | 'admin';
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface RegisterVendorRequest {
  email: string;
  password: string;
}

export interface RegisterVendorResponse {
  id: string;
  email: string;
}

export const authApi = {
  async login(email: string, password: string, role: Role): Promise<{ token: string; user: User }> {
    const response = await apiClient.post<LoginResponse>('/auth/login', {
      email,
      password,
      role,
    });

    apiClient.setAuthToken(response.token);

    return {
      token: response.token,
      user: {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role as Role,
      },
    };
  },

  async registerVendor(email: string, password: string): Promise<RegisterVendorResponse> {
    return apiClient.post<RegisterVendorResponse>('/vendors/register', {
      email,
      password,
    });
  },

  logout(): void {
    apiClient.removeAuthToken();
  },
};
