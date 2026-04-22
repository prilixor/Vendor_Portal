import { apiClient } from "@/app/services/apiClient";

export interface VendorProfileApiDto {
  id: string;
  vendorId: string;
  businessName: string;
  ownerName: string;
  supportPhone: string;
  gstNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  onboardingCompleted: boolean;
}

export interface VendorDocumentApiDto {
  id: string;
  vendorId: string;
  documentType: string;
  fileUrl: string;
  documentNumber?: string;
  verificationStatus: string;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface VendorVerificationRequestApiDto {
  id: string;
  vendorId: string;
  reviewStatus: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface VendorBankAccountApiDto {
  id: string;
  vendorId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  verificationStatus: string;
  verifiedAt?: string;
}

export interface VendorServiceAreaApiDto {
  id: string;
  vendorId: string;
  areaName: string;
  city: string;
  centerLatitude: number;
  centerLongitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
}

export interface VendorWorkingHourApiDto {
  id: string;
  vendorId: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface VendorAvailabilityOverrideApiDto {
  id: string;
  vendorId: string;
  overrideDate: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface ProductCategoryApiDto {
  id: string;
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isActive: boolean;
}

export interface ProductApiDto {
  id: string;
  categoryId: string;
  productName: string;
  brandName?: string;
  modelName?: string;
  shortDescription?: string;
  longDescription?: string;
  isActive: boolean;
}

export interface VendorProductListingApiDto {
  id: string;
  vendorId: string;
  productId: string;
  listingTitle: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  availableQuantity: number;
  listingStatus: string;
}

export interface VendorProductImageApiDto {
  id: string;
  vendorProductListingId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface VendorProductDocumentApiDto {
  id: string;
  vendorProductListingId: string;
  documentType: string;
  fileUrl: string;
  verificationStatus: string;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface VendorInventoryApiDto {
  id: string;
  vendorProductListingId: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  rentedQuantity: number;
  blockedQuantity: number;
}

export interface VendorInventoryMovementApiDto {
  id: string;
  vendorInventoryId: string;
  movementType: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
}

export interface UploadedFileResponse {
  fileUrl: string;
  fileName: string;
  originalFileName: string;
  contentType: string;
  size: number;
}

export interface UpsertVendorProfilePayload {
  vendorId: string;
  businessName: string;
  ownerName: string;
  supportPhone: string;
  gstNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
}

export interface AddVendorDocumentPayload {
  vendorId: string;
  documentType: string;
  fileUrl: string;
  documentNumber?: string;
}

export interface CreateVendorBankAccountPayload {
  vendorId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface UpdateVendorBankAccountPayload extends CreateVendorBankAccountPayload {
  bankAccountId: string;
}

export interface CreateVendorServiceAreaPayload {
  vendorId: string;
  areaName: string;
  city: string;
  centerLatitude: number;
  centerLongitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
}

export interface UpdateVendorServiceAreaPayload extends CreateVendorServiceAreaPayload {
  serviceAreaId: string;
}

export interface UpsertVendorWorkingHourPayload {
  vendorId: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface UpsertVendorAvailabilityOverridePayload {
  vendorId: string;
  overrideDate: string;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export interface CreateProductCategoryPayload {
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isActive: boolean;
}

export interface CreateProductPayload {
  categoryId: string;
  productName: string;
  brandName?: string;
  modelName?: string;
  shortDescription?: string;
  longDescription?: string;
  isActive: boolean;
}

export interface UpsertVendorProductListingPayload {
  vendorId: string;
  productId: string;
  listingTitle: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  availableQuantity: number;
  listingStatus: string;
}

export interface UpdateVendorProductListingPayload extends UpsertVendorProductListingPayload {
  listingId: string;
}

export interface AddVendorProductImagePayload {
  vendorId: string;
  listingId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface AddVendorProductDocumentPayload {
  vendorId: string;
  listingId: string;
  documentType: string;
  fileUrl: string;
}

export interface UpsertVendorInventoryPayload {
  vendorId: string;
  listingId: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  rentedQuantity: number;
  blockedQuantity: number;
}

export interface AddVendorInventoryMovementPayload {
  vendorId: string;
  listingId: string;
  movementType: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}

export interface UpsertVendorNotificationPreferencePayload {
  vendorId: string;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  newOrderNotifications: boolean;
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
}

export const vendorOnboardingApi = {
  uploadVendorFile(vendorId: string, file: File) {
    const data = new FormData();
    data.append("vendorId", vendorId);
    data.append("file", file);
    return apiClient.postForm<UploadedFileResponse>("/files/upload", data);
  },

  getVendorProfile(vendorId: string) {
    return apiClient.get<VendorProfileApiDto>(`/vendors/${vendorId}/profile`);
  },

  upsertVendorProfile(vendorId: string, payload: UpsertVendorProfilePayload) {
    return apiClient.put<VendorProfileApiDto>(`/vendors/${vendorId}/profile`, payload);
  },

  addVendorDocument(vendorId: string, payload: AddVendorDocumentPayload) {
    return apiClient.post<VendorDocumentApiDto>(`/vendors/${vendorId}/documents`, payload);
  },

  getVendorDocuments(vendorId: string) {
    return apiClient.get<VendorDocumentApiDto[]>(`/vendors/${vendorId}/documents`);
  },

  deleteVendorDocument(vendorId: string, documentId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/documents/${documentId}`);
  },

  createVerificationRequest(vendorId: string) {
    return apiClient.post<VendorVerificationRequestApiDto>(`/vendors/${vendorId}/verification-requests`, { vendorId });
  },

  getVerificationRequests(vendorId: string) {
    return apiClient.get<VendorVerificationRequestApiDto[]>(`/vendors/${vendorId}/verification-requests`);
  },

  createVendorBankAccount(vendorId: string, payload: CreateVendorBankAccountPayload) {
    return apiClient.post<VendorBankAccountApiDto>(`/vendors/${vendorId}/bank-accounts`, payload);
  },

  updateVendorBankAccount(vendorId: string, bankAccountId: string, payload: UpdateVendorBankAccountPayload) {
    return apiClient.put<VendorBankAccountApiDto>(`/vendors/${vendorId}/bank-accounts/${bankAccountId}`, payload);
  },

  getVendorBankAccounts(vendorId: string) {
    return apiClient.get<VendorBankAccountApiDto[]>(`/vendors/${vendorId}/bank-accounts`);
  },

  createVendorServiceArea(vendorId: string, payload: CreateVendorServiceAreaPayload) {
    return apiClient.post<VendorServiceAreaApiDto>(`/vendors/${vendorId}/service-areas`, payload);
  },

  updateVendorServiceArea(vendorId: string, serviceAreaId: string, payload: UpdateVendorServiceAreaPayload) {
    return apiClient.put<VendorServiceAreaApiDto>(`/vendors/${vendorId}/service-areas/${serviceAreaId}`, payload);
  },

  getVendorServiceAreas(vendorId: string) {
    return apiClient.get<VendorServiceAreaApiDto[]>(`/vendors/${vendorId}/service-areas`);
  },

  deleteVendorServiceArea(vendorId: string, serviceAreaId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/service-areas/${serviceAreaId}`);
  },

  upsertVendorWorkingHour(vendorId: string, dayOfWeek: number, payload: UpsertVendorWorkingHourPayload) {
    return apiClient.put<VendorWorkingHourApiDto>(`/vendors/${vendorId}/working-hours/${dayOfWeek}`, payload);
  },

  getVendorWorkingHours(vendorId: string) {
    return apiClient.get<VendorWorkingHourApiDto[]>(`/vendors/${vendorId}/working-hours`);
  },

  upsertVendorAvailabilityOverride(vendorId: string, overrideDate: string, payload: UpsertVendorAvailabilityOverridePayload) {
    return apiClient.put<VendorAvailabilityOverrideApiDto>(`/vendors/${vendorId}/availability-overrides/${overrideDate}`, payload);
  },

  getVendorAvailabilityOverrides(vendorId: string) {
    return apiClient.get<VendorAvailabilityOverrideApiDto[]>(`/vendors/${vendorId}/availability-overrides`);
  },

  deleteVendorAvailabilityOverride(vendorId: string, overrideId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/availability-overrides/${overrideId}`);
  },

  createProductCategory(payload: CreateProductCategoryPayload) {
    return apiClient.post<ProductCategoryApiDto>("/vendors/catalog/categories", payload);
  },

  getProductCategories() {
    return apiClient.get<ProductCategoryApiDto[]>("/vendors/catalog/categories");
  },

  createProduct(payload: CreateProductPayload) {
    return apiClient.post<ProductApiDto>("/vendors/catalog/products", payload);
  },

  getProducts(categoryId?: string) {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    return apiClient.get<ProductApiDto[]>(`/vendors/catalog/products${query}`);
  },

  createVendorProductListing(vendorId: string, payload: UpsertVendorProductListingPayload) {
    return apiClient.post<VendorProductListingApiDto>(`/vendors/${vendorId}/listings`, payload);
  },

  updateVendorProductListing(vendorId: string, listingId: string, payload: UpdateVendorProductListingPayload) {
    return apiClient.put<VendorProductListingApiDto>(`/vendors/${vendorId}/listings/${listingId}`, payload);
  },

  getVendorProductListings(vendorId: string) {
    return apiClient.get<VendorProductListingApiDto[]>(`/vendors/${vendorId}/listings`);
  },

  addVendorProductImage(vendorId: string, listingId: string, payload: AddVendorProductImagePayload) {
    return apiClient.post<VendorProductImageApiDto>(`/vendors/${vendorId}/listings/${listingId}/images`, payload);
  },

  getVendorProductImages(vendorId: string, listingId: string) {
    return apiClient.get<VendorProductImageApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/images`);
  },

  addVendorProductDocument(vendorId: string, listingId: string, payload: AddVendorProductDocumentPayload) {
    return apiClient.post<VendorProductDocumentApiDto>(`/vendors/${vendorId}/listings/${listingId}/documents`, payload);
  },

  getVendorProductDocuments(vendorId: string, listingId: string) {
    return apiClient.get<VendorProductDocumentApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/documents`);
  },

  upsertVendorInventory(vendorId: string, listingId: string, payload: UpsertVendorInventoryPayload) {
    return apiClient.put<VendorInventoryApiDto>(`/vendors/${vendorId}/listings/${listingId}/inventory`, payload);
  },

  getVendorInventory(vendorId: string, listingId: string) {
    return apiClient.get<VendorInventoryApiDto>(`/vendors/${vendorId}/listings/${listingId}/inventory`);
  },

  addVendorInventoryMovement(vendorId: string, listingId: string, payload: AddVendorInventoryMovementPayload) {
    return apiClient.post<VendorInventoryMovementApiDto>(`/vendors/${vendorId}/listings/${listingId}/inventory/movements`, payload);
  },

  getVendorInventoryMovements(vendorId: string, listingId: string) {
    return apiClient.get<VendorInventoryMovementApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/inventory/movements`);
  },

  upsertVendorNotificationPreference(vendorId: string, payload: UpsertVendorNotificationPreferencePayload) {
    return apiClient.put<VendorNotificationPreferenceDto>(`/vendors/${vendorId}/notification-preferences`, payload);
  },

  getVendorNotificationPreference(vendorId: string) {
    return apiClient.get<VendorNotificationPreferenceDto>(`/vendors/${vendorId}/notification-preferences`);
  },

  getVendorNotifications(vendorId: string) {
    return apiClient.get<VendorNotificationDto[]>(`/vendors/${vendorId}/notifications`);
  },

  markVendorNotificationAsRead(vendorId: string, notificationId: string) {
    return apiClient.patch<VendorNotificationDto>(`/vendors/${vendorId}/notifications/${notificationId}/read`);
  },

  markVendorNotificationAsUnread(vendorId: string, notificationId: string) {
    return apiClient.patch<VendorNotificationDto>(`/vendors/${vendorId}/notifications/${notificationId}/unread`);
  },

  markAllVendorNotificationsAsRead(vendorId: string) {
    return apiClient.patch<MarkAllNotificationsReadResponse>(`/vendors/${vendorId}/notifications/read-all`);
  },
};
