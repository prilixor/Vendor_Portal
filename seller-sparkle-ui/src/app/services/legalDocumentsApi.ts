import { apiClient } from "./apiClient";

export interface LegalPlacementDto {
  surface: string;
  screen: string;
  isVisible: boolean;
  isRequiredToProceed: boolean;
  sortOrder: number;
}

export interface LegalDocumentListItemDto {
  id: string;
  slug: string;
  documentType: string;
  title: string;
  audience: string;
  summary?: string | null;
  publicPath?: string | null;
  sortOrder: number;
  isRequiredAcceptance: boolean;
  status: string;
  publishedVersionNumber?: number | null;
  draftVersionNumber?: number | null;
  effectiveFrom?: string | null;
  lastUpdated?: string | null;
  updatedBy?: string | null;
  visibleToCustomer: boolean;
  visibleToVendor: boolean;
  requiredAtCustomerRegister: boolean;
  requiredAtVendorRegister: boolean;
}

export interface LegalDocumentDetailDto extends LegalDocumentListItemDto {
  publishedVersionId?: string | null;
  draftVersionId?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  draftContentHtml?: string | null;
  draftContentMarkdown?: string | null;
  changeSummary?: string | null;
  isMaterialChange: boolean;
  placements: LegalPlacementDto[];
}

export interface LegalDocumentVersionSummaryDto {
  id: string;
  versionNumber: number;
  status: string;
  changeSummary?: string | null;
  isMaterialChange: boolean;
  effectiveFrom: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

export interface LegalDocumentVersionDetailDto extends LegalDocumentVersionSummaryDto {
  documentId: string;
  title: string;
  contentHtml: string;
  contentMarkdown?: string | null;
}

export const LEGAL_SURFACES = [
  { id: "admin_web", label: "Admin web" },
  { id: "vendor_web", label: "Vendor web" },
  { id: "customer_web", label: "Customer web" },
  { id: "customer_mobile", label: "Customer mobile" },
  { id: "vendor_mobile", label: "Vendor mobile" },
] as const;

export const LEGAL_SCREENS = [
  { id: "footer", label: "Footer" },
  { id: "register", label: "Register" },
  { id: "login", label: "Login" },
  { id: "checkout", label: "Checkout" },
  { id: "profile_settings", label: "Profile / settings" },
  { id: "landing", label: "Landing" },
  { id: "onboarding", label: "Onboarding" },
  { id: "support", label: "Support" },
  { id: "legal_hub", label: "Legal hub" },
  { id: "order_confirm", label: "Order confirm" },
  { id: "first_launch", label: "First launch" },
  { id: "product_detail", label: "Product detail" },
  { id: "order_cancel", label: "Order cancel" },
  { id: "prescription", label: "Prescription" },
  { id: "vendor_dashboard", label: "Vendor dashboard" },
  { id: "reconsent", label: "Re-consent" },
] as const;

export const legalDocumentsApi = {
  list: () => apiClient.get<LegalDocumentListItemDto[]>("/admin/legal-documents"),

  get: (id: string) => apiClient.get<LegalDocumentDetailDto>(`/admin/legal-documents/${id}`),

  update: (id: string, data: {
    title: string;
    slug: string;
    summary?: string | null;
    publicPath?: string | null;
    audience: string;
    sortOrder: number;
    isRequiredAcceptance: boolean;
    placements: LegalPlacementDto[];
  }) => apiClient.put<LegalDocumentDetailDto>(`/admin/legal-documents/${id}`, data),

  saveDraft: (id: string, data: {
    contentHtml?: string;
    contentMarkdown?: string | null;
    changeSummary?: string | null;
  }) => apiClient.put<LegalDocumentDetailDto>(`/admin/legal-documents/${id}/draft`, data),

  publish: (id: string, data: {
    versionId?: string | null;
    effectiveFrom?: string | null;
    changeSummary?: string | null;
    isMaterialChange?: boolean;
  }) => apiClient.post<LegalDocumentDetailDto>(`/admin/legal-documents/${id}/publish`, data),

  listVersions: (id: string) =>
    apiClient.get<LegalDocumentVersionSummaryDto[]>(`/admin/legal-documents/${id}/versions`),

  getVersion: (id: string, versionId: string) =>
    apiClient.get<LegalDocumentVersionDetailDto>(`/admin/legal-documents/${id}/versions/${versionId}`),

  listAcceptances: (params?: { actorType?: string; documentId?: string; screen?: string }) => {
    const query = new URLSearchParams();
    if (params?.actorType) query.set("actorType", params.actorType);
    if (params?.documentId) query.set("documentId", params.documentId);
    if (params?.screen) query.set("screen", params.screen);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<LegalAcceptanceAdminDto[]>(`/admin/legal-documents/acceptances${suffix}`);
  },
};

export interface LegalAcceptanceAdminDto {
  id: string;
  actorType: string;
  actorId: string;
  actorName: string;
  actorEmail?: string | null;
  documentId: string;
  documentTitle: string;
  documentSlug: string;
  versionId: string;
  versionNumber: number;
  acceptedAt: string;
  sourceSurface: string;
  sourceScreen: string;
  signedName?: string | null;
  ipAddress?: string | null;
}
