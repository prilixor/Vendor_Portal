import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type SupportChatOpenRequest = {
  message: string;
  category?: string;
};

export type SupportPanelOpenRequest = {
  ticketId?: string;
  nonce: number;
};

type SupportChatContextValue = {
  openSupportChat: (request: SupportChatOpenRequest) => void;
  pendingRequest: SupportChatOpenRequest | null;
  consumePendingRequest: () => void;
  /** Open the Support FAB panel (optionally to a ticket). Used when vendor taps a support notification. */
  openSupportPanel: (opts?: { ticketId?: string }) => void;
  panelOpenRequest: SupportPanelOpenRequest | null;
  consumePanelOpenRequest: () => void;
};

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const [pendingRequest, setPendingRequest] = useState<SupportChatOpenRequest | null>(null);
  const [panelOpenRequest, setPanelOpenRequest] = useState<SupportPanelOpenRequest | null>(null);

  const openSupportChat = useCallback((request: SupportChatOpenRequest) => {
    setPendingRequest(request);
  }, []);

  const consumePendingRequest = useCallback(() => {
    setPendingRequest(null);
  }, []);

  const openSupportPanel = useCallback((opts?: { ticketId?: string }) => {
    setPanelOpenRequest({ ticketId: opts?.ticketId, nonce: Date.now() });
  }, []);

  const consumePanelOpenRequest = useCallback(() => {
    setPanelOpenRequest(null);
  }, []);

  return (
    <SupportChatContext.Provider
      value={{
        openSupportChat,
        pendingRequest,
        consumePendingRequest,
        openSupportPanel,
        panelOpenRequest,
        consumePanelOpenRequest,
      }}
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
