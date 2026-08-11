import { apiClient } from "@/app/services/apiClient";

export interface ChatSessionApi {
  id: string;
  customerId: string;
  customerName: string;
  vendorId: string | null;
  vendorName: string;
  counterpartyType: "Admin" | "Vendor";
  counterpartyName: string;
  orderId: string | null;
  orderNumber: string | null;
  subject: string;
  lastMessageAt: string;
  isClosed: boolean;
  /** Unread messages from the other party (Customer→Admin for admin inbox). */
  unreadCount?: number;
}

export interface ChatMessageApi {
  id: string;
  chatSessionId: string;
  senderType: "Customer" | "Vendor" | "Admin";
  messageText: string;
  sentAt: string;
  isRead: boolean;
}

export const chatApi = {
  // Customer Chat Methods (Customer ↔ Admin for order chats)
  createCustomerSession(payload: { vendorId?: string | null; orderId?: string | null; subject?: string }): Promise<ChatSessionApi> {
    return apiClient.post<ChatSessionApi>("/customers/me/chats/sessions", payload);
  },

  getCustomerSessions(): Promise<ChatSessionApi[]> {
    return apiClient.get<ChatSessionApi[]>("/customers/me/chats/sessions");
  },

  getCustomerMessages(sessionId: string): Promise<ChatMessageApi[]> {
    return apiClient.get<ChatMessageApi[]>(`/customers/me/chats/sessions/${encodeURIComponent(sessionId)}/messages`);
  },

  sendCustomerMessage(sessionId: string, messageText: string): Promise<ChatMessageApi> {
    return apiClient.post<ChatMessageApi>(`/customers/me/chats/sessions/${encodeURIComponent(sessionId)}/messages`, {
      messageText,
    });
  },

  // Admin Chat Methods (Customer ↔ Admin inbox)
  getAdminSessions(): Promise<ChatSessionApi[]> {
    return apiClient.get<ChatSessionApi[]>("/admin/chats/sessions");
  },

  getAdminUnreadCount(): Promise<{ count: number }> {
    return apiClient.get<{ count: number }>("/admin/chats/unread-count");
  },

  getAdminMessages(sessionId: string): Promise<ChatMessageApi[]> {
    return apiClient.get<ChatMessageApi[]>(`/admin/chats/sessions/${encodeURIComponent(sessionId)}/messages`);
  },

  sendAdminMessage(sessionId: string, messageText: string): Promise<ChatMessageApi> {
    return apiClient.post<ChatMessageApi>(`/admin/chats/sessions/${encodeURIComponent(sessionId)}/messages`, {
      messageText,
    });
  },

  // Vendor Chat Methods (legacy Vendor counterparty only)
  getVendorSessions(vendorId: string): Promise<ChatSessionApi[]> {
    return apiClient.get<ChatSessionApi[]>(`/vendors/${encodeURIComponent(vendorId)}/chats/sessions`);
  },

  getVendorMessages(vendorId: string, sessionId: string): Promise<ChatMessageApi[]> {
    return apiClient.get<ChatMessageApi[]>(`/vendors/${encodeURIComponent(vendorId)}/chats/sessions/${encodeURIComponent(sessionId)}/messages`);
  },

  sendVendorMessage(vendorId: string, sessionId: string, messageText: string): Promise<ChatMessageApi> {
    return apiClient.post<ChatMessageApi>(`/vendors/${encodeURIComponent(vendorId)}/chats/sessions/${encodeURIComponent(sessionId)}/messages`, {
      messageText,
    });
  },
};
