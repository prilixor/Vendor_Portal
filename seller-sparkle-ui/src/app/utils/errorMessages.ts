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
  if (error && typeof error === "object") {
    const err = error as ErrorResponse;
    if (err.code) return err.code;
    if (err.detail && typeof err.detail === "string") {
      // Try to extract code from detail message if it contains error code pattern
      const match = err.detail.match(/([a-z_]+\.[a-z_]+)/i);
      if (match) return match[1];
    }
  }
  return null;
}

/**
 * Get user-friendly error message
 * Logs technical error to console and returns user-friendly message
 */
export function getUserFriendlyMessage(error: unknown): string {
  // Log technical error for debugging
  console.error("[Technical Error]", error);

  // Check for network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return genericMessages.network;
  }

  // Check for error code in response
  const errorCode = extractErrorCode(error);
  if (errorCode && errorMessages[errorCode]) {
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
