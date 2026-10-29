import { apiClient } from "./apiClient";

export interface PendingLegalReconsent {
  slug: string;
  title: string;
  publicPath: string;
  versionNumber: number;
  effectiveFrom: string;
}

export const legalAcceptanceApi = {
  listCustomerPending: () =>
    apiClient.get<PendingLegalReconsent[]>("/customers/me/legal-reconsent"),

  acceptCustomer: (payload: { screen: string; acceptedLegal: boolean; sourceSurface?: string; signedName?: string }) =>
    apiClient.post<number>("/customers/me/legal-acceptances", payload),

  listVendorPending: (vendorId: string) =>
    apiClient.get<PendingLegalReconsent[]>(`/vendors/${vendorId}/legal-reconsent`),

  acceptVendor: (
    vendorId: string,
    payload: { screen: string; acceptedLegal: boolean; sourceSurface?: string; signedName?: string },
  ) => apiClient.post<number>(`/vendors/${vendorId}/legal-acceptances`, payload),
};
