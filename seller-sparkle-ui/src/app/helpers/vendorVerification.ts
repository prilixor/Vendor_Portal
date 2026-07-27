import type { AccountStatus, RegistrationStage, VendorDocument, VerificationStatus } from "@/app/models";

export const REQUIRED_DOCUMENT_TYPES = [
  "GST Certificate",
  "PAN Card",
  "Trade License",
  "Address Proof",
  "Cancelled Cheque",
] as const;

export type RequiredDocumentType = (typeof REQUIRED_DOCUMENT_TYPES)[number];

export const VENDOR_OPERATIONS_PATHS = [
  "/vendor/products",
  "/vendor/inventory",
  "/vendor/order-requests",
  "/vendor/orders",
  "/vendor/expirations",
] as const;

export type VendorVerificationBannerVariant =
  | "missing_docs"
  | "pending_review"
  | "rejected"
  | "account_rejected"
  | "account_suspended";

export interface DocumentChecklistItem {
  type: RequiredDocumentType;
  status: "missing" | VerificationStatus;
  document?: VendorDocument;
}

export interface VendorVerificationSnapshot {
  accountStatus: AccountStatus | null;
  registrationStage: RegistrationStage | null;
  documents: VendorDocument[];
  bankStatus: VerificationStatus;
  checklist: DocumentChecklistItem[];
  missingDocuments: RequiredDocumentType[];
  rejectedDocuments: VendorDocument[];
  pendingDocuments: VendorDocument[];
  approvedDocumentCount: number;
  allDocumentsUploaded: boolean;
  allDocumentsApproved: boolean;
  hasRejectedItems: boolean;
  operationsBlocked: boolean;
  bannerVariant: VendorVerificationBannerVariant | null;
  onboardingHref: string;
}

export function normalizeVerificationStatus(status?: string | null): VerificationStatus {
  if (!status) return "pending";
  const normalized = status.toLowerCase();
  if (normalized === "under_review" || normalized === "submitted") return "under_review";
  if (normalized === "approved" || normalized === "rejected" || normalized === "pending") {
    return normalized;
  }
  return "pending";
}

export function isVendorOperationsPath(pathname: string): boolean {
  return VENDOR_OPERATIONS_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getMissingDocumentTypes(documents: VendorDocument[]): RequiredDocumentType[] {
  const uploaded = new Set(documents.map((doc) => doc.type));
  return REQUIRED_DOCUMENT_TYPES.filter((type) => !uploaded.has(type));
}

export function buildDocumentChecklist(documents: VendorDocument[]): DocumentChecklistItem[] {
  return REQUIRED_DOCUMENT_TYPES.map((type) => {
    const document = documents.find((doc) => doc.type === type);
    return {
      type,
      status: document ? document.status : "missing",
      document,
    };
  });
}

export function computeVendorVerificationSnapshot(input: {
  accountStatus?: string | null;
  registrationStage?: string | null;
  documents: VendorDocument[];
  bankStatus?: VerificationStatus;
}): VendorVerificationSnapshot {
  const accountStatus = (input.accountStatus ?? null) as AccountStatus | null;
  const registrationStage = (input.registrationStage ?? null) as RegistrationStage | null;
  const bankStatus = input.bankStatus ?? "pending";
  const checklist = buildDocumentChecklist(input.documents);
  const missingDocuments = getMissingDocumentTypes(input.documents);
  const rejectedDocuments = input.documents.filter((doc) => doc.status === "rejected");
  const pendingDocuments = input.documents.filter(
    (doc) => doc.status === "pending" || doc.status === "under_review",
  );
  const approvedDocumentCount = input.documents.filter((doc) => doc.status === "approved").length;
  const allDocumentsUploaded = missingDocuments.length === 0;
  const allDocumentsApproved =
    allDocumentsUploaded && input.documents.every((doc) => doc.status === "approved");
  const hasRejectedItems = rejectedDocuments.length > 0 || bankStatus === "rejected";

  const accountBlocksOperations =
    accountStatus === "pending" ||
    accountStatus === "rejected" ||
    accountStatus === "suspended" ||
    accountStatus === "banned";

  const operationsBlocked =
    accountBlocksOperations || missingDocuments.length > 0 || hasRejectedItems;

  let bannerVariant: VendorVerificationBannerVariant | null = null;
  if (operationsBlocked) {
    if (accountStatus === "rejected") {
      bannerVariant = "account_rejected";
    } else if (accountStatus === "suspended" || accountStatus === "banned") {
      bannerVariant = "account_suspended";
    } else if (hasRejectedItems) {
      bannerVariant = "rejected";
    } else if (missingDocuments.length > 0) {
      bannerVariant = "missing_docs";
    } else {
      bannerVariant = "pending_review";
    }
  }

  let onboardingHref = "/vendor/onboarding?tab=docs";
  if (hasRejectedItems && bankStatus === "rejected" && rejectedDocuments.length === 0) {
    onboardingHref = "/vendor/onboarding?tab=bank";
  } else if (registrationStage === "profile_pending") {
    onboardingHref = "/vendor/onboarding?tab=profile";
  }

  return {
    accountStatus,
    registrationStage,
    documents: input.documents,
    bankStatus,
    checklist,
    missingDocuments,
    rejectedDocuments,
    pendingDocuments,
    approvedDocumentCount,
    allDocumentsUploaded,
    allDocumentsApproved,
    hasRejectedItems,
    operationsBlocked,
    bannerVariant,
    onboardingHref,
  };
}
