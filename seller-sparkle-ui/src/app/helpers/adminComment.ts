const MEANINGLESS_COMMENT = /^(yes|no|true|false|null|n\/a|na|-)$/i;

const UUID_IN_MESSAGE =
  /\s*\[?ID:\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]?/gi;

/** Filters admin-entered rejection notes for vendor-facing UI. */
export function sanitizeAdminComment(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value || MEANINGLESS_COMMENT.test(value)) return null;
  return value;
}

/** Parses admin notes embedded in notification messages (`Reason: ...`). */
export function extractAdminCommentFromNotification(message: string): string | null {
  const match = message.trim().match(/Reason:\s*(.+)$/is);
  if (!match?.[1]) return null;
  return sanitizeAdminComment(match[1]);
}

/** Removes a trailing `Reason: ...` suffix when shown separately in UI. */
export function notificationBodyWithoutAdminReason(message: string): string {
  return message.replace(/\s*Reason:\s*.+$/is, "").trim();
}

export function cleanNotificationMessage(message: string): string {
  let text = message.replace(UUID_IN_MESSAGE, "").trim();
  text = text.replace(
    /\s*Reason:\s*(yes|no|true|false|null|n\/a|na|-)\.?\s*$/i,
    "",
  );
  text = text.replace(/\s{2,}/g, " ").trim();
  return text;
}

export function isVerificationRejectionNotification(notificationType: string): boolean {
  const type = notificationType.trim().toLowerCase();
  return (
    type.startsWith("document_") ||
    type.startsWith("bank_") ||
    type.includes("rejected")
  );
}

export function notificationDisplayMessage(message: string, notificationType: string): string {
  const cleaned = cleanNotificationMessage(message);
  if (!isVerificationRejectionNotification(notificationType)) return cleaned;

  const adminComment = extractAdminCommentFromNotification(message);
  if (!adminComment) return cleaned;

  return cleanNotificationMessage(notificationBodyWithoutAdminReason(cleaned));
}

type RejectedVerificationDoc = {
  type: string;
  rejectionReason?: string | null;
};

/** Pre-filled support message for rejected onboarding items (mobile parity). */
export function buildVerificationSupportMessage(
  rejectedDocuments: RejectedVerificationDoc[],
  rejectedBank: boolean,
): { message: string; category: string } {
  const docNames = rejectedDocuments.map((doc) => doc.type);
  let message =
    docNames.length === 0
      ? "My bank account verification was rejected. I need help understanding what to fix and resubmit."
      : `My ${docNames.join(", ")} verification was rejected${rejectedBank ? " and my bank account was also rejected" : ""}. I need help understanding what to fix and resubmit.`;

  const adminNotes = rejectedDocuments
    .map((doc) => {
      const comment = sanitizeAdminComment(doc.rejectionReason);
      return comment ? `${doc.type}: "${comment}"` : null;
    })
    .filter((line): line is string => line != null)
    .join("\n");

  if (adminNotes) {
    message += `\n\nAdmin notes:\n${adminNotes}`;
  }

  return {
    message,
    category: docNames.length === 0 ? "Verification" : "Documents",
  };
}
