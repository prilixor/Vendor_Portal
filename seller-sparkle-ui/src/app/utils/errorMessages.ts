// Error message mapping utility for user-friendly notifications
// Technical errors are logged to console, users see friendly messages only (never raw error codes).

export interface ErrorResponse {
  message?: string;
  code?: string;
  detail?: string;
  title?: string;
}

/** Matches backend codes like customers.out_of_service_area, vendors.account_pending, EMAIL_NOT_VERIFIED */
const ERROR_CODE_PATTERN =
  /(?:vendors|customers|admins|documents|bank_accounts|auth|catalog|orders|directory)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*|EMAIL_NOT_VERIFIED/i;

const BRACKET_CODE_PATTERN = /\s*\[([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+|EMAIL_NOT_VERIFIED)\]\s*/gi;

// Backend error code → user-friendly message
const errorMessages: Record<string, string> = {
  // Vendor approval errors
  "vendors.invalid_id": "Invalid vendor ID provided.",
  "vendors.not_found": "Vendor not found.",
  "vendors.invalid_status": "Vendor status is invalid for this action.",
  "vendors.account_pending":
    "Your account is pending approval. You'll be able to add products once approved.",
  "vendors.no_documents": "Vendor must upload at least one document before approval.",
  "vendors.insufficient_documents": "Vendor must upload exactly 5 documents.",
  "vendors.documents_not_approved": "All documents must be approved before vendor can be approved.",
  "vendors.no_bank_account": "Vendor must upload at least one bank account before approval.",
  "vendors.bank_account_not_approved":
    "At least one bank account must be approved before vendor can be approved.",
  "vendors.no_service_area":
    "Vendor must have a business location / service area before approval.",
  "vendors.service_radius_not_set":
    "Admin must set the coverage radius for all service areas before approval.",
  "vendors.listing.active_orders":
    "Cannot delete listing because there are active or pending customer rental orders associated with it. Please complete or cancel those orders first.",
  "vendors.vendor_location_missing":
    "This vendor has not set up a delivery location yet. Please try another listing.",
  "vendors.service_area.location_required":
    "Place the pin on the map (search, click, or drag) before saving this service area. Area name and city alone are not enough.",
  "vendors.service_area.invalid_location":
    "Please set a valid map pin for this service area.",
  "vendor_service_areas.invalid_id": "Invalid service area.",
  "vendor_service_areas.not_found": "Service area not found.",

  // Customer checkout / delivery
  "customers.out_of_service_area":
    "This delivery address is outside the vendor's service area. Please choose another address that the vendor can deliver to, or remove this item from your cart.",
  "customers.vendor_location_missing":
    "This item cannot be delivered yet because the vendor's location is not set up. Please try another product or contact support.",
  "customers.delivery_distance_error":
    "We couldn't verify delivery for this address. Please check your address or try again.",
  "customers.address_required": "Please select a delivery address to continue.",
  "customers.invalid_address": "Please select a valid delivery address.",
  "customers.address_not_found": "Address not found.",
  "customers.address_pin_required":
    "Place the pin on the map before saving. Address text alone is not enough for delivery.",
  "customers.stock_unavailable":
    "Some items are out of stock or no longer available. Please update your cart and try again.",
  "customers.listing_not_found": "One or more items in your cart are no longer available.",
  "customers.quantity_exceeds_stock":
    "Requested quantity is higher than available stock. Please reduce the quantity and try again.",

  // Admin errors
  "admins.invalid_id": "Invalid admin ID provided.",
  "admins.not_found": "Admin not found.",

  // Document errors
  "documents.not_found": "Document not found.",
  "documents.invalid_type": "Invalid document type.",

  // Bank account errors
  "bank_accounts.not_found": "Bank account not found.",
  "bank_accounts.invalid_ifsc": "Invalid IFSC code format.",

  // Auth
  EMAIL_NOT_VERIFIED: "Please verify your email before continuing.",
  "auth.invalid_credentials": "Invalid email or password.",
  "auth.token_expired": "This link has expired. Please request a new one.",

  // Medical directory
  "directory.doctor_not_found":
    "No doctor found for this Unique ID. Please check the ID and try again.",
  "directory.doctor_code_required": "Enter the doctor's Unique ID.",

  // General errors
  unauthorized: "You are not authorized to perform this action.",
  forbidden: "Access denied.",
  not_found: "Resource not found.",
  validation_error: "Please check your input and try again.",
  server_error: "Something went wrong. Please try again.",
  network_error: "No internet connection. Please check your network and try again.",
};

const genericMessages = {
  network: "No internet connection. Please check your network and try again.",
  server: "Something went wrong. Please try again later.",
  validation: "Please check your input and try again.",
  unknown: "An unexpected error occurred. Please try again.",
};

function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("://") || trimmed.startsWith("http")) return null;
  const match = trimmed.match(ERROR_CODE_PATTERN);
  return match ? match[0] : null;
}

/** Strip technical error codes from any user-facing string. */
export function stripErrorCodes(message: string): string {
  return message
    .replace(BRACKET_CODE_PATTERN, " ")
    .replace(
      /\b(?:vendors|customers|admins|documents|bank_accounts|auth|catalog|orders|directory)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*\b/gi,
      " ",
    )
    .replace(/\bEMAIL_NOT_VERIFIED\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const err = error as ErrorResponse & Error & { code?: string };

  const fromCode = normalizeCode(err.code);
  if (fromCode) return fromCode;

  const fromTitle = normalizeCode(err.title);
  if (fromTitle) return fromTitle;

  if (err.message && typeof err.message === "string") {
    const bracketMatch = err.message.match(/\[([^\]]+)\]/);
    const fromBracket = normalizeCode(bracketMatch?.[1]);
    if (fromBracket) return fromBracket;
    const fromMessage = normalizeCode(err.message);
    if (fromMessage) return fromMessage;
  }

  if (err.detail && typeof err.detail === "string") {
    return normalizeCode(err.detail);
  }

  return null;
}

function looksLikeTechnicalCode(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (ERROR_CODE_PATTERN.test(t) && !t.includes(" ")) return true;
  if (/^[a-z0-9_.-]+$/i.test(t) && t.includes(".")) return true;
  return false;
}

/**
 * Get user-friendly error message (never includes backend error codes).
 * Optional fallback is used when nothing useful can be derived.
 */
export function getUserFriendlyMessage(error: unknown, fallback?: string): string {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return genericMessages.network;
  }

  let originalMessage = "";
  if (error instanceof Error) {
    originalMessage = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    originalMessage = String((error as ErrorResponse).message || "");
  } else if (typeof error === "string") {
    originalMessage = error;
  }

  const cleanMessage = stripErrorCodes(originalMessage);
  const errorCode = extractErrorCode(error);

  if (errorCode && errorMessages[errorCode]) {
    // Prefer mapped copy for known delivery/checkout codes so users get actionable guidance.
    if (
      errorCode.startsWith("customers.") ||
      errorCode.startsWith("vendors.account_") ||
      errorCode.startsWith("directory.") ||
      !cleanMessage ||
      looksLikeTechnicalCode(cleanMessage) ||
      cleanMessage.length < 12 ||
      /^an error occurred$/i.test(cleanMessage)
    ) {
      return errorMessages[errorCode];
    }
    // Backend detail already user-friendly — keep it (without codes).
    if (
      cleanMessage.length > 10 &&
      cleanMessage.includes(" ") &&
      !cleanMessage.includes("Exception") &&
      !/^error:/i.test(cleanMessage)
    ) {
      return cleanMessage;
    }
    return errorMessages[errorCode];
  }

  if (error instanceof Error) {
    for (const [code, message] of Object.entries(errorMessages)) {
      if (error.message.includes(code)) {
        return message;
      }
    }
  }

  if (
    cleanMessage &&
    cleanMessage.length > 5 &&
    !looksLikeTechnicalCode(cleanMessage) &&
    !cleanMessage.includes("Exception") &&
    !/^error:/i.test(cleanMessage)
  ) {
    return cleanMessage;
  }

  if (fallback?.trim()) return fallback.trim();

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

export function showErrorToast(error: unknown, customMessage?: string): string {
  return customMessage || getUserFriendlyMessage(error);
}
