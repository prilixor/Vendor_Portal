import { apiClient } from "@/app/services/apiClient";

export interface ChatSessionApi {
  id: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  orderId: string | null;
  orderNumber: string | null;
  subject: string;
  lastMessageAt: string;
  isClosed: boolean;
}

export interface ChatMessageApi {
  id: string;
  chatSessionId: string;
  senderType: "Customer" | "Vendor";
  messageText: string;
  sentAt: string;
  isRead: boolean;
}

export const chatApi = {
  // Customer Chat Methods
  createCustomerSession(payload: { vendorId: string; orderId?: string | null; subject?: string }): Promise<ChatSessionApi> {
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

  // Vendor Chat Methods
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
