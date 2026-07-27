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

export interface VendorStatusDto {
  id: string;
  email: string;
  isEmailVerified: boolean;
  verificationTokenExpiryUtc?: string | null;
  accountStatus: string;
  registrationStage: string;
  lastLoginAt?: string;
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
  branchName: string;
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
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  gstPercent: number;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  isActive: boolean;
  casNumber?: string;
  chemicalFormula?: string;
  purityPercentage?: number;
  molecularWeight?: number;
  baseUnit?: string;
  sdsDocumentUrl?: string;
  coaDocumentUrl?: string;
  variants?: ProductVariantPayload[];
}

export interface VendorProductListingApiDto {
  id: string;
  vendorId: string;
  productId: string;
  listingTitle: string;
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  availableQuantity: number;
  listingStatus: string;
  favoriteCount: number;
  isChemical?: boolean;
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

export interface VendorProductAssetApiDto {
  id: string;
  vendorProductListingId: string;
  assetTag: string;
  status: string;
  condition?: string;
  createdAt: string;
  productVariantId?: string | null;
  variantLabel?: string | null;
}

export interface TrackedAssetDto {
  assetId: string;
  assetTag: string;
  status: string;
  condition?: string;
  productName: string;
  currentOrderId?: string;
  currentOrderNumber?: string;
  currentCustomerName?: string;
  dueDate?: string;
}

export interface UpsertVendorProductAssetPayload {
  vendorId: string;
  listingId: string;
  assetTag: string;
  status: string;
  condition?: string;
  productVariantId?: string | null;
}

export interface VendorInventoryMovementApiDto {
  id: string;
  vendorInventoryId: string;
  movementType: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  eventAt: string;
}

export interface UploadedFileResponse {
  fileUrl: string;
  /** Persist this with documents/listings when set (S3 path relative to the configured prefix); omit legacy/local absolute URLs. */
  storageKey?: string | null;
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
  branchName: string;
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
  isChemical?: boolean;
  isActive: boolean;
}

export interface ProductVariantPayload {
  id?: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  vendorPrice: number;
  buyPrice: number;
  isActive: boolean;
}

export interface CreateProductPayload {
  categoryId: string;
  productName: string;
  brandName?: string;
  modelName?: string;
  shortDescription?: string;
  longDescription?: string;
  dailyRent?: number;
  weeklyRent?: number;
  monthlyRent?: number;
  securityDeposit?: number;
  buyPrice?: number;
  vendorDailyRent?: number;
  vendorMonthlyRent?: number;
  vendorSecurityDeposit?: number;
  vendorBuyPrice?: number;
  gstPercent?: number;
  isRentEnabled?: boolean;
  isBuyEnabled?: boolean;
  isActive: boolean;
  casNumber?: string;
  chemicalFormula?: string;
  purityPercentage?: number;
  molecularWeight?: number;
  baseUnit?: string;
  sdsDocumentUrl?: string;
  coaDocumentUrl?: string;
  variants?: ProductVariantPayload[];
}

export interface UpsertVendorProductListingPayload {
  vendorId: string;
  productId: string;
  listingTitle: string;
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

export interface VendorNotificationPreferenceDto {
  id: string;
  vendorId: string;
  emailNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  newOrderNotifications: boolean;
}

export interface VendorNotificationDto {
  id: string;
  vendorId: string;
  notificationType: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  sentAt?: string;
  readAt?: string;
}

export interface VendorDispatchOfferApiDto {
  offerId: string;
  orderId: string;
  orderNumber: string;
  listingId: string;
  listingTitle: string;
  orderType: string;
  quantity: number;
  rentalDays: number;
  rentalPeriodUnit?: "day" | "week" | "month";
  expiresAt: string;
  status: string;
  totalAmount: number;
  vendorSubtotalAmount: number;
  startDate?: string;
  endDate?: string;
  listingPrimaryImageUrl?: string | null;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorUniqueCode?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalCity?: string;
  doctorContactNumber?: string;
}

export interface VendorOrderApiDto {
  orderId: string;
  orderNumber: string;
  status: string;
  orderType: string;
  quantity: number;
  rentalDays: number;
  rentalPeriodUnit?: "day" | "week" | "month";
  totalAmount: number;
  vendorSubtotalAmount: number;
  startDate?: string;
  endDate?: string;
  listingId: string;
  listingTitle: string;
  listingPrimaryImageUrl?: string;
  customerName: string;
  customerCity?: string;
  customerState?: string;
  createdAtUtc: string;
  isExtended?: boolean;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorUniqueCode?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalCity?: string;
  doctorContactNumber?: string;
  assignedAssetTags?: string[];
  productVariantId?: string;
}

export interface VendorExpiringOrderApiDto {
  orderId: string;
  orderNumber: string;
  listingTitle: string;
  vendorName: string;
  customerName: string;
  status: string;
  orderType: string;
  endDate: string;
  daysLeft: number;
  /** Backward-compatible fallback if an older response shape is still returned. */
  daysUntilEnd?: number;
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number;
}

export interface VendorPushSubscriptionDto {
  id: string;
  vendorId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface RegisterPushSubscriptionPayload {
  vendorId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export enum VendorFileFolderType {
  Documents = 'Documents',
  ProductImages = 'ProductImages',
  ProductDocuments = 'ProductDocuments'
}

export const vendorOnboardingApi = {
  uploadVendorFile(vendorId: string, file: File, folderType: VendorFileFolderType = VendorFileFolderType.Documents) {
    const data = new FormData();
    data.append("vendorId", vendorId);
    data.append("file", file);
    data.append("folderType", folderType);
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

  deleteVendorProductListing(vendorId: string, listingId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/listings/${listingId}`);
  },

  addVendorProductImage(vendorId: string, listingId: string, payload: AddVendorProductImagePayload) {
    return apiClient.post<VendorProductImageApiDto>(`/vendors/${vendorId}/listings/${listingId}/images`, payload);
  },

  getVendorProductImages(vendorId: string, listingId: string) {
    return apiClient.get<VendorProductImageApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/images`);
  },

  deleteVendorProductImage(vendorId: string, listingId: string, imageId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/listings/${listingId}/images/${imageId}`);
  },

  addVendorProductDocument(vendorId: string, listingId: string, payload: AddVendorProductDocumentPayload) {
    return apiClient.post<VendorProductDocumentApiDto>(`/vendors/${vendorId}/listings/${listingId}/documents`, payload);
  },

  getVendorProductDocuments(vendorId: string, listingId: string) {
    return apiClient.get<VendorProductDocumentApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/documents`);
  },

  deleteVendorProductDocument(vendorId: string, listingId: string, documentId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/listings/${listingId}/documents/${documentId}`);
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

  getVendorProductAssets(vendorId: string, listingId: string) {
    return apiClient.get<VendorProductAssetApiDto[]>(`/vendors/${vendorId}/listings/${listingId}/assets`);
  },

  addVendorProductAsset(vendorId: string, listingId: string, payload: UpsertVendorProductAssetPayload) {
    return apiClient.post<VendorProductAssetApiDto>(`/vendors/${vendorId}/listings/${listingId}/assets`, payload);
  },

  updateVendorProductAsset(vendorId: string, listingId: string, assetId: string, payload: UpsertVendorProductAssetPayload) {
    return apiClient.put<VendorProductAssetApiDto>(`/vendors/${vendorId}/listings/${listingId}/assets/${assetId}`, payload);
  },

  deleteVendorProductAsset(vendorId: string, listingId: string, assetId: string) {
    return apiClient.delete<void>(`/vendors/${vendorId}/listings/${listingId}/assets/${assetId}`);
  },

  trackVendorProductAsset(vendorId: string, assetTag: string) {
    return apiClient.get<TrackedAssetDto>(`/vendors/${vendorId}/inventory/assets/track?tag=${encodeURIComponent(assetTag)}`);
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
    return apiClient.patch<VendorNotificationDto>(`/vendors/${vendorId}/notifications/${notificationId}/read`, { vendorId, notificationId });
  },

  markVendorNotificationAsUnread(vendorId: string, notificationId: string) {
    return apiClient.patch<VendorNotificationDto>(`/vendors/${vendorId}/notifications/${notificationId}/unread`, { vendorId, notificationId });
  },

  markAllVendorNotificationsAsRead(vendorId: string) {
    return apiClient.patch<MarkAllNotificationsReadResponse>(`/vendors/${vendorId}/notifications/read-all`, { vendorId });
  },

  getVendorStatus(vendorId: string) {
    return apiClient.get<VendorStatusDto>(`/vendors/${vendorId}`);
  },

  getVendorDispatchOffers(vendorId: string) {
    return apiClient.get<VendorDispatchOfferApiDto[]>(`/vendors/${vendorId}/dispatch/offers`);
  },

  acceptVendorDispatchOrder(vendorId: string, orderId: string) {
    return apiClient.patch(`/vendors/${vendorId}/dispatch/orders/${orderId}/accept`, {});
  },

  rejectVendorDispatchOrder(vendorId: string, orderId: string) {
    return apiClient.patch(`/vendors/${vendorId}/dispatch/orders/${orderId}/reject`, {});
  },

  cancelAssignedVendorOrder(vendorId: string, orderId: string) {
    return apiClient.patch(`/vendors/${vendorId}/dispatch/orders/${orderId}/cancel`, {});
  },

  getVendorOrders(vendorId: string, status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiClient.get<VendorOrderApiDto[]>(`/vendors/${vendorId}/orders${query}`);
  },

  getVendorOrder(vendorId: string, orderId: string) {
    return apiClient.get<VendorOrderApiDto>(`/vendors/${vendorId}/orders/${orderId}`);
  },

  updateVendorOrderStatus(vendorId: string, orderId: string, status: string, assetTags?: string[]) {
    return apiClient.patch(`/vendors/${vendorId}/orders/${orderId}/status`, { status, assetTags });
  },

  getVendorOrderExpirations(vendorId: string, withinDays = 7) {
    return apiClient.get<VendorExpiringOrderApiDto[]>(`/vendors/${vendorId}/orders/expirations?withinDays=${withinDays}`);
  },

  // Push subscription methods
  registerPushSubscription(vendorId: string, payload: RegisterPushSubscriptionPayload) {
    return apiClient.post<VendorPushSubscriptionDto>(`/vendors/${vendorId}/push-subscription`, payload);
  },

  unregisterPushSubscription(vendorId: string) {
    return apiClient.delete<boolean>(`/vendors/${vendorId}/push-subscription`);
  },

  getPushSubscription(vendorId: string) {
    return apiClient.get<VendorPushSubscriptionDto | null>(`/vendors/${vendorId}/push-subscription`);
  },

  getUnreadNotificationCount(vendorId: string) {
    return apiClient.get<number>(`/vendors/${vendorId}/notifications/unread-count`);
  },

  createNotification(vendorId: string, title: string, message: string, type: string = "info") {
    return apiClient.post<VendorNotificationDto>(`/vendors/${vendorId}/notifications`, {
      vendorId,
      title,
      message,
      notificationType: type,
      channel: "in_app", // Required field - must be one of: in_app, email, push, sms
      status: "sent", // Required for notification to appear in inbox
    });
  },

  // CountryStateCity API methods
  getIndianStates() {
    return apiClient.get<{ name: string; iso2: string }[]>("/vendors/locations/states");
  },

  getCitiesByState(stateIso2: string) {
    return apiClient.get<{ name: string }[]>(`/vendors/locations/states/${encodeURIComponent(stateIso2)}/cities`);
  },

  getVendorOrderContinuations(orderId: string) {
    return apiClient.get<OrderContinuationsDto>(`/vendors/me/orders/${orderId}/continuations`);
  },
  approveVendorExtension(orderId: string, extensionId: string, overrides?: any) {
    return apiClient.post(`/vendors/me/orders/${orderId}/extensions/${extensionId}/approve`, overrides ?? {});
  },
  cancelVendorExtension(orderId: string, extensionId: string) {
    return apiClient.post(`/vendors/me/orders/${orderId}/extensions/${extensionId}/cancel`, {});
  },
  approveVendorBuyout(orderId: string, buyoutId: string, overrides?: any) {
    return apiClient.post(`/vendors/me/orders/${orderId}/buyouts/${buyoutId}/approve`, overrides ?? {});
  },
  cancelVendorBuyout(orderId: string, buyoutId: string) {
    return apiClient.post(`/vendors/me/orders/${orderId}/buyouts/${buyoutId}/cancel`, {});
  },

  // --- Variant-level (SKU-level) chemical inventory ---
  getVariantInventory(vendorId: string, listingId: string) {
    return apiClient.get<VendorVariantInventoryDto[]>(`/vendors/${vendorId}/listings/${listingId}/variant-inventory`);
  },

  upsertVariantInventory(vendorId: string, listingId: string, items: { productVariantId: string; totalQuantity: number }[]) {
    return apiClient.put<VendorVariantInventoryDto[]>(`/vendors/${vendorId}/listings/${listingId}/variant-inventory`, { items });
  },
};

export interface VendorVariantInventoryDto {
  id: string;
  vendorProductListingId: string;
  productVariantId: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
}

export interface PendingExtensionDto {
  extensionId: string;
  orderId: string;
  additionalDays: number;
  extensionAmount: number;
  serviceFeeAmount: number;
  gstAmount: number;
  totalAmount: number;
  originalEndDate: string;
  newEndDate: string;
  createdAtUtc: string;
}

export interface PendingBuyoutDto {
  buyoutId: string;
  orderId: string;
  baseBuyoutAmount: number;
  rentDeductionAmount: number;
  serviceFeeAmount: number;
  gstAmount: number;
  totalAmount: number;
  createdAtUtc: string;
}

export interface OrderContinuationsDto {
  pendingExtensions: PendingExtensionDto[];
  pendingBuyouts: PendingBuyoutDto[];
}
