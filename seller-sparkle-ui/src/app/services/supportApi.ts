import { apiClient, type ApiClientOptions } from "@/app/services/apiClient";

export interface AdminSupportTicketListResult {
  items: SupportTicketDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

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
  unreadCount?: number;
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
  attachmentUrls?: string[];
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
  getTicketMessages: (ticketId: string, opts?: { markReadForAdmin?: boolean }) => {
    const qs = opts?.markReadForAdmin ? "?markReadForAdmin=true" : "";
    return apiClient.get<SupportMessageDto[]>(`/support/tickets/${ticketId}/messages${qs}`);
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
  getAllTickets: (options?: { quiet?: boolean }) => {
    return apiClient.get<SupportTicketDto[]>("/support/admin/tickets", options);
  },
  getAdminTicketSummaries: (params: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  } = {}, options?: ApiClientOptions) => {
    const qs = new URLSearchParams();
    const search = params.search?.trim();
    if (search) qs.set("search", search);
    if (params.status && params.status !== "all") qs.set("status", params.status);
    qs.set("page", String(params.page && params.page > 0 ? params.page : 1));
    qs.set("pageSize", String(params.pageSize && params.pageSize > 0 ? params.pageSize : 8));
    if (params.unreadOnly) qs.set("unreadOnly", "true");
    return apiClient.get<AdminSupportTicketListResult>(
      `/support/admin/tickets/summaries?${qs.toString()}`,
      options,
    );
  },
  getAdminTicket: (ticketId: string, options?: ApiClientOptions) => {
    return apiClient.get<SupportTicketDto>(`/support/admin/tickets/${ticketId}`, options);
  },
  getAdminUnreadCount: () => {
    return apiClient.get<{ count: number }>("/support/admin/unread-count");
  },
  updateTicketStatus: (ticketId: string, request: UpdateTicketStatusRequest) => {
    return apiClient.patch<void>(`/support/admin/tickets/${ticketId}/status`, request);
  },
};
