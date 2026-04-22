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

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  updatedAt: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
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

  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
    return apiClient.post<ChangePasswordResponse>('/auth/change-password', payload);
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<ResetPasswordResponse> {
    return apiClient.post<ResetPasswordResponse>('/auth/reset-password', {
      token,
      newPassword,
      confirmPassword,
    });
  },

  logout(): void {
    apiClient.removeAuthToken();
  },
};
