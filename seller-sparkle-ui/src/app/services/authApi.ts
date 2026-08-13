import { apiClient } from './apiClient';
import { User, Role } from '@/app/models';

export interface LoginRequest {
  email: string;
  password: string;
  role: 'vendor' | 'customer' | 'admin' | 'super_admin' | 'verifier' | 'operations_admin';
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
  supportPhone: string;
}

export interface RegisterVendorResponse {
  id: string;
  email: string;
}

export interface RegisterCustomerResponse {
  id: string;
  email?: string | null;
  fullName: string;
  requiresPhoneOtp: boolean;
  requiresEmailVerification: boolean;
}

export interface ChangePasswordPayload {
  email: string;
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
  /** customer | vendor | admin — preserved on the email reset link */
  portal?: "customer" | "vendor" | "admin";
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

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

export interface PhoneOtpActionResponse {
  success: boolean;
  message: string;
  isPhoneVerified: boolean;
  phone?: string | null;
}

export interface ForgotPasswordSmsVerifiedResponse {
  success: boolean;
  message: string;
  resetToken: string;
  phone?: string | null;
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

  async registerVendor(email: string, password: string, supportPhone: string): Promise<RegisterVendorResponse> {
    return apiClient.post<RegisterVendorResponse>('/vendors/register', {
      email,
      password,
      supportPhone,
    });
  },

  async registerCustomer(
    email: string | null | undefined,
    password: string,
    fullName: string,
    phone: string | null | undefined,
  ): Promise<RegisterCustomerResponse> {
    return apiClient.post<RegisterCustomerResponse>('/customers/register', {
      email: email?.trim() || null,
      password,
      fullName,
      phone: phone?.trim() || null,
    });
  },

  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    return apiClient.get<VerifyEmailResponse>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  async resendVerification(
    email: string,
    role?: "customer" | "vendor",
  ): Promise<ResendVerificationResponse> {
    return apiClient.post<ResendVerificationResponse>('/auth/resend-verification', { email, role });
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
    return apiClient.post<ChangePasswordResponse>('/auth/change-password', payload);
  },

  async forgotPassword(
    email: string,
    portal?: "customer" | "vendor" | "admin",
  ): Promise<ForgotPasswordResponse> {
    return apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', { email, portal });
  },

  async sendForgotPasswordSmsOtp(
    phone: string,
    role: 'customer' | 'vendor' = 'customer',
  ): Promise<PhoneOtpActionResponse> {
    return apiClient.post<PhoneOtpActionResponse>('/auth/forgot-password/sms/send-otp', { phone, role });
  },

  async verifyForgotPasswordSmsOtp(
    phone: string,
    code: string,
    role: 'customer' | 'vendor' = 'customer',
  ): Promise<ForgotPasswordSmsVerifiedResponse> {
    return apiClient.post<ForgotPasswordSmsVerifiedResponse>('/auth/forgot-password/sms/verify-otp', {
      phone,
      code,
      role,
    });
  },

  async resetPasswordWithSmsOtp(
    phone: string,
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
    role: 'customer' | 'vendor' = 'customer',
  ): Promise<PhoneOtpActionResponse> {
    return apiClient.post<PhoneOtpActionResponse>('/auth/forgot-password/sms/reset', {
      phone,
      resetToken,
      newPassword,
      confirmPassword,
      role,
    });
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<ResetPasswordResponse> {
    return apiClient.post<ResetPasswordResponse>('/auth/reset-password', {
      token,
      newPassword,
      confirmPassword,
    });
  },

  async sendPhoneOtp(phone: string, role: 'vendor' | 'customer'): Promise<PhoneOtpActionResponse> {
    return apiClient.post<PhoneOtpActionResponse>('/auth/phone/send-otp', { phone, role });
  },

  async verifyPhoneOtp(phone: string, code: string, role: 'vendor' | 'customer'): Promise<PhoneOtpActionResponse> {
    return apiClient.post<PhoneOtpActionResponse>('/auth/phone/verify-otp', { phone, code, role });
  },

  logout(): void {
    apiClient.removeAuthToken();
  },
};
