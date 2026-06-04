// Error message mapping utility for user-friendly notifications
// Technical errors are logged to console, users see friendly messages

export interface ErrorResponse {
  message?: string;
  code?: string;
  detail?: string;
}

// Backend error code to user-friendly message mapping
const errorMessages: Record<string, string> = {
  // Vendor approval errors
  "vendors.invalid_id": "Invalid vendor ID provided.",
  "vendors.not_found": "Vendor not found.",
  "vendors.invalid_status": "Vendor status is invalid for this action.",
  "vendors.account_pending": "Your account is pending approval. You'll be able to add products once approved.",
  "vendors.no_documents": "Vendor must upload at least one document before approval.",
  "vendors.insufficient_documents": "Vendor must upload exactly 5 documents.",
  "vendors.documents_not_approved": "All documents must be approved before vendor can be approved.",
  "vendors.no_bank_account": "Vendor must upload at least one bank account before approval.",
  "vendors.bank_account_not_approved": "At least one bank account must be approved before vendor can be approved.",

  // Vendor listing/product errors
  "vendors.listing.active_orders": "Cannot delete listing because there are active or pending customer rental orders associated with it. Please complete or cancel those orders first.",

  // Admin errors
  "admins.invalid_id": "Invalid admin ID provided.",
  "admins.not_found": "Admin not found.",

  // Document errors
  "documents.not_found": "Document not found.",
  "documents.invalid_type": "Invalid document type.",

  // Bank account errors
  "bank_accounts.not_found": "Bank account not found.",
  "bank_accounts.invalid_ifsc": "Invalid IFSC code format.",

  // General errors
  "unauthorized": "You are not authorized to perform this action.",
  "forbidden": "Access denied.",
  "not_found": "Resource not found.",
  "validation_error": "Please check your input and try again.",
  "server_error": "Something went wrong. Please try again.",
  "network_error": "Unable to connect. Please check your internet connection.",
};

// Generic fallback messages by error type
const genericMessages = {
  network: "Unable to connect. Please check your internet connection.",
  server: "Something went wrong. Please try again later.",
  validation: "Please check your input and try again.",
  unknown: "An unexpected error occurred. Please try again.",
};

/**
 * Extract error code from error response
 */
function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const err = error as ErrorResponse & Error;

  // Check for code property directly
  if (err.code) return err.code;

  // Check Error message for bracket format: "message [error.code]"
  if (err.message && typeof err.message === "string") {
    const bracketMatch = err.message.match(/\[([a-z_]+(?:\.[a-z_]+)+)\]$/i);
    if (bracketMatch) return bracketMatch[1];
  }

  // Check detail property
  if (err.detail && typeof err.detail === "string") {
    const match = err.detail.match(/([a-z_]+(?:\.[a-z_]+)+)/i);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get user-friendly error message
 * Logs technical error to console and returns user-friendly message
 */
export function getUserFriendlyMessage(error: unknown): string {
  // Check for network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return genericMessages.network;
  }

  // Get the original error message if available
  let originalMessage = "";
  if (error instanceof Error) {
    originalMessage = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    originalMessage = (error as ErrorResponse).message || "";
  }

  // Check for error code in response
  const errorCode = extractErrorCode(error);

  if (errorCode && errorMessages[errorCode]) {
    // If backend message already has useful dynamic content (like "Currently uploaded: 2/5"),
    // and it's user-friendly (contains spaces, reasonable length), use it instead
    const cleanMessage = originalMessage.replace(/\[[a-z_]+(?:\.[a-z_]+)+\]$/i, "").trim();
    if (cleanMessage.length > 10 && cleanMessage.includes(" ") && !cleanMessage.includes("Exception") && !cleanMessage.includes("Error:")) {
      return cleanMessage;
    }
    return errorMessages[errorCode];
  }

  // Check for Error instance with message
  if (error instanceof Error) {
    // Check if the error message contains a known error code
    for (const [code, message] of Object.entries(errorMessages)) {
      if (error.message.includes(code)) {
        return message;
      }
    }
  }

  // Return generic message based on error type
  if (error instanceof Error) {
    if (error.message.includes("network") || error.message.includes("fetch")) {
      return genericMessages.network;
    }
    if (error.message.includes("500") || error.message.includes("server")) {
      return genericMessages.server;
    }
    if (error.message.includes("400") || error.message.includes("validation")) {
      return genericMessages.validation;
    }
  }

  return genericMessages.unknown;
}

/**
 * Show user-friendly error toast
 * Wraps toast.error with user-friendly message extraction
 */
export function showErrorToast(error: unknown, customMessage?: string): string {
  const message = customMessage || getUserFriendlyMessage(error);
  return message;
}
