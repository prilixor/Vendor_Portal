import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type SupportChatOpenRequest = {
  message: string;
  category?: string;
};

type SupportChatContextValue = {
  openSupportChat: (request: SupportChatOpenRequest) => void;
  pendingRequest: SupportChatOpenRequest | null;
  consumePendingRequest: () => void;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const [pendingRequest, setPendingRequest] = useState<SupportChatOpenRequest | null>(null);

  const openSupportChat = useCallback((request: SupportChatOpenRequest) => {
    setPendingRequest(request);
  }, []);

  const consumePendingRequest = useCallback(() => {
    setPendingRequest(null);
  }, []);

  return (
    <SupportChatContext.Provider
      value={{ openSupportChat, pendingRequest, consumePendingRequest }}
    >
      {children}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const context = useContext(SupportChatContext);
  if (!context) {
    throw new Error("useSupportChat must be used within SupportChatProvider");
  }
  return context;
}
