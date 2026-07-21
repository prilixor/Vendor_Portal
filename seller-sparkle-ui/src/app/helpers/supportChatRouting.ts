import { SupportMessageDto } from "@/app/services/supportApi";

export const SUPPORT_ESCALATION_MESSAGE =
  "Our support team will assist you shortly.";

export function isSupportEscalationMessage(message: string): boolean {
  const normalized = message.trim().replace(/\.$/, "").toLowerCase();
  if (normalized.includes("support team will assist")) {
    return true;
  }
  return (
    normalized === SUPPORT_ESCALATION_MESSAGE.replace(/\.$/, "").toLowerCase()
  );
}

/**
 * Real support flow:
 * - New thread / AI-only phase → ai-chat (one AI reply, then escalate)
 * - After escalation or once admin joins → plain message only (no AI)
 */
export function shouldUseAiChat(params: {
  ticketId: string | null;
  ticketStatus: string | null;
  messages: SupportMessageDto[];
  forceNewTicket?: boolean;
}): boolean {
  if (params.forceNewTicket && !params.ticketId) {
    return true;
  }

  if (!params.ticketId) {
    return true;
  }

  const status = (params.ticketStatus ?? "").trim().toLowerCase();
  if (status === "in progress" || status === "resolved" || status === "closed") {
    return false;
  }

  if (
    params.messages.some(
      (message) => message.senderType.toLowerCase() === "admin",
    )
  ) {
    return false;
  }

  if (
    params.messages.some(
      (message) =>
        message.senderType.toLowerCase() === "ai" &&
        isSupportEscalationMessage(message.message),
    )
  ) {
    return false;
  }

  return true;
}

export function isWaitingForHumanSupport(params: {
  messages: SupportMessageDto[];
  sending: boolean;
}): boolean {
  if (params.messages.length === 0 || params.sending) return false;
  if (params.messages.some((m) => m.senderType.toLowerCase() === "admin")) {
    return false;
  }
  const hasEscalation = params.messages.some(
    (m) =>
      m.senderType.toLowerCase() === "ai" &&
      isSupportEscalationMessage(m.message),
  );
  if (!hasEscalation) return false;
  return (
    params.messages[params.messages.length - 1]?.senderType.toLowerCase() ===
    "vendor"
  );
}
