import { apiClient } from "@/app/services/apiClient";

export interface SupportTicketDto {
  id: string;
  ticketNumber: string;
  category: string;
  subject: string;
  status: string;
  vendorEmail?: string;
  vendorBusinessName?: string;
  createdAt: string;
  updatedAt?: string;
  latestMessage?: SupportMessageDto;
}

export interface SupportMessageDto {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: string;
  message: string;
  createdAt: string;
  attachmentUrls?: string[];
}

export interface CreateSupportTicketRequest {
  vendorId: string;
  category: string;
  subject: string;
  message: string;
}

export interface SendSupportMessageRequest {
  senderId: string;
  senderType: string;
  message: string;
}

export interface UpdateTicketStatusRequest {
  status: string;
  adminId: string;
}

export interface AiChatRequest {
  vendorId: string;
  message: string;
  category?: string;
  subject?: string;
  forceNewTicket?: boolean;
  attachmentUrls?: string[];
}

export interface AiChatResult {
  ticket: SupportTicketDto;
  aiMessage?: SupportMessageDto | null;
}

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
  size: number;
}

export const supportApi = {
  // Vendor
  createTicket: (request: CreateSupportTicketRequest) => {
    return apiClient.post<SupportTicketDto>("/support/tickets", request);
  },
  getVendorTickets: (vendorId: string) => {
    return apiClient.get<SupportTicketDto[]>(`/support/tickets/vendor/${vendorId}`);
  },
  getTicketMessages: (ticketId: string) => {
    return apiClient.get<SupportMessageDto[]>(`/support/tickets/${ticketId}/messages`);
  },
  sendMessage: (ticketId: string, request: SendSupportMessageRequest) => {
    return apiClient.post<SupportMessageDto>(`/support/tickets/${ticketId}/messages`, request);
  },

  // AI Chat
  aiChat: (request: AiChatRequest) => {
    return apiClient.post<AiChatResult>("/support/ai-chat", request);
  },

  // File Upload
  uploadFile: (vendorId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("vendorId", vendorId);
    return apiClient.postForm<UploadResult>("/support/upload", formData);
  },

  // Admin
  getAllTickets: () => {
    return apiClient.get<SupportTicketDto[]>("/support/admin/tickets");
  },
  updateTicketStatus: (ticketId: string, request: UpdateTicketStatusRequest) => {
    return apiClient.patch<void>(`/support/admin/tickets/${ticketId}/status`, request);
  },
};