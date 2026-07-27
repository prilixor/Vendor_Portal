import { apiClient } from './apiClient';

// Request/Response Types
export interface VendorDto {
  id: string;
  email: string;
  isEmailVerified: boolean;
  verificationTokenExpiryUtc?: string | null;
  accountStatus: string;
  registrationStage: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface VendorProfileDto {
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

export interface VendorDocumentDto {
  id: string;
  vendorId: string;
  documentType: string;
  fileUrl: string;
  documentNumber?: string;
  verificationStatus: string;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface VendorBankAccountDto {
  id: string;
  vendorId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  verificationStatus: string;
  verifiedAt?: string;
}

export interface VendorServiceAreaDto {
  id: string;
  vendorId: string;
  areaName: string;
  city: string;
  centerLatitude: number;
  centerLongitude: number;
  serviceRadiusKm: number;
  isActive: boolean;
}

export interface VendorWorkingHourDto {
  id: string;
  vendorId: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface VendorProductListingDto {
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

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  roleId?: string;
  isSystemUser?: boolean;
  mustChangePassword?: boolean;
}

export interface RegisterAdminUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  roleId?: string;
}

export interface AdminRoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissionCodes: string[];
}

export interface AdminPermissionDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
}

export interface AdminCustomerListItemDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  orderCount: number;
}

export interface AdminCustomerDetailDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  addresses: {
    id: string;
    label?: string;
    line1: string;
    city: string;
    state: string;
    postal: string;
    isDefault: boolean;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    placedByAdminId?: string;
  }[];
}

export interface AdminOrderableListingDto {
  listingId: string;
  vendorId: string;
  productId: string;
  title: string;
  vendorName: string;
  categoryName: string;
  isChemical: boolean;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  dailyRent: number;
  weeklyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  maxBuyPrice?: number;
  availableQuantity: number;
  availabilityStatus: string;
  listingStatus: string;
  primaryImageUrl?: string | null;
  prescriptionRequired?: boolean;
}

export interface VendorImpersonationStartDto {
  exchangeCode: string;
  vendorId: string;
  vendorName: string;
  expiresAt: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
}

export interface PortalImpersonationStartDto {
  exchangeCode: string;
  targetType: string;
  targetId: string;
  targetName: string;
  expiresAt: string;
}

export interface AdminAuditLogDto {
  id: string;
  adminId: string;
  adminName?: string;
  adminEmail?: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  createdAt: string;
}

export interface AddAdminAuditLogRequest {
  adminUserId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
}

export interface VendorBankAccountDto {
  id: string;
  vendorId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  verificationStatus: string;
  verifiedAt?: string;
}

export interface VerifyVendorBankAccountRequest {
  adminUserId: string;
  vendorId: string;
  bankAccountId: string;
  verificationStatus: string;
  notes?: string;
}

export interface VendorDocumentDto {
  id: string;
  vendorId: string;
  documentType: string;
  fileUrl: string;
  documentNumber?: string;
  verificationStatus: string;
  rejectionReason?: string;
  verifiedAt?: string;
}

export interface VerifyVendorDocumentRequest {
  adminUserId: string;
  vendorId: string;
  documentId: string;
  verificationStatus: string;
  notes?: string;
}

export interface VendorProductListingDto {
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

export interface VerifyVendorListingRequest {
  adminUserId: string;
  vendorId: string;
  listingId: string;
  listingStatus: string;
  notes?: string;
}

export interface AdminPasswordResetDto {
  vendorId: string;
  message: string;
  updatedAt: string;
}

export interface ForceResetAdminPasswordDto {
  adminUserId: string;
  message: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  updatedAt: string;
}

export interface ForceResetVendorPasswordRequest {
  adminUserId: string;
  vendorId: string;
  newPassword: string;
  notes?: string;
}

export interface ApproveVendorRequest {
  adminUserId: string;
  vendorId: string;
}

export interface RejectVendorRequest {
  adminUserId: string;
  vendorId: string;
  reason?: string;
}

export interface SuspendVendorRequest {
  adminUserId: string;
  vendorId: string;
  reason?: string;
}

export interface BanVendorRequest {
  adminUserId: string;
  vendorId: string;
  reason?: string;
}

export interface ReactivateVendorRequest {
  adminUserId: string;
  vendorId: string;
  reason?: string;
}

// Catalog DTOs
export interface ProductCategoryDto {
  id: string;
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isChemical?: boolean;
  isActive: boolean;
}

export interface ProductVariantDto {
  id?: string;
  productId?: string;
  sku: string;
  sizeValue: number;
  sizeUnit: string;
  vendorPrice: number;
  buyPrice: number;
  isActive: boolean;
}

export interface ProductDto {
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
  vendorDailyRent: number;
  vendorWeeklyRent: number;
  vendorMonthlyRent: number;
  vendorSecurityDeposit: number;
  vendorBuyPrice?: number;
  gstPercent: number;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  isActive: boolean;
  images?: ProductImageDto[];
  casNumber?: string;
  chemicalFormula?: string;
  purityPercentage?: number;
  molecularWeight?: number;
  baseUnit?: string;
  sdsDocumentUrl?: string;
  coaDocumentUrl?: string;
  favoriteCount: number;
  variants?: ProductVariantDto[];
}

export interface ProductImageDto {
  id: string;
  productId: string;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface AddProductImageRequest {
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

export interface UploadedFileResponse {
  fileUrl: string;
  storageKey?: string | null;
  fileName?: string;
  originalFileName?: string;
  contentType?: string;
  size?: number;
}

export interface CreateProductCategoryRequest {
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isChemical?: boolean;
  isActive: boolean;
}

export interface UpdateProductCategoryRequest {
  id: string;
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isChemical?: boolean;
  isActive: boolean;
}

export interface AdminDoctorDto {
  id: string;
  fullName: string;
  uniqueCode: string;
  email: string;
  specialization?: string | null;
  contactNumber?: string | null;
  isActive: boolean;
  publicPageUrl?: string | null;
  hospitals?: AdminHospitalDto[] | null;
}

export interface AdminHospitalDto {
  id: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactNumber?: string | null;
  isActive: boolean;
  doctorIds?: string[] | null;
  doctorNames?: string[] | null;
}

export interface AdminHospitalInput {
  name: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  contactNumber?: string;
}

export interface CreateAdminDoctorRequest {
  fullName: string;
  email: string;
  specialization?: string;
  contactNumber?: string;
  sendEmail?: boolean;
  hospitalIds?: string[];
  newHospitals?: AdminHospitalInput[];
}

export interface UpdateAdminDoctorRequest {
  id: string;
  fullName: string;
  email: string;
  specialization?: string;
  contactNumber?: string;
  isActive: boolean;
  hospitalIds?: string[];
  newHospitals?: AdminHospitalInput[];
}

export interface CreateAdminHospitalRequest extends AdminHospitalInput {
  doctorIds?: string[];
}

export interface UpdateAdminHospitalRequest extends AdminHospitalInput {
  id: string;
  isActive: boolean;
  doctorIds?: string[];
}

export interface CreateProductRequest {
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
  vendorDailyRent: number;
  vendorWeeklyRent: number;
  vendorMonthlyRent: number;
  vendorSecurityDeposit: number;
  vendorBuyPrice?: number;
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
  variants?: ProductVariantDto[];
}

export interface UpdateProductRequest {
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
  vendorDailyRent: number;
  vendorWeeklyRent: number;
  vendorMonthlyRent: number;
  vendorSecurityDeposit: number;
  vendorBuyPrice?: number;
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
  variants?: ProductVariantDto[];
}

export interface ExcelUploadErrorDto {
  row: number;
  sheet: string;
  field: string;
  message: string;
}

export interface ExcelUploadResponseDto {
  success: boolean;
  errors: ExcelUploadErrorDto[];
  categoriesCreated: number;
  productsCreated: number;
}

export interface AdminOrderDto {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  vendorName: string;
  listingTitle: string;
  status: string;
  orderType: string;
  quantity: number;
  rentalDays: number;
  totalAmount: number;
  depositAmount: number;
  vendorSubtotalAmount: number;
  createdOnUtc: string;
  startDate?: string | null;
  endDate?: string | null;
  primaryImageUrl?: string | null;
  isExtended?: boolean;
  productVariantId?: string | null;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorUniqueCode?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalCity?: string;
  doctorContactNumber?: string;
}

export interface UpdateAdminOrderStatusRequest {
  adminUserId: string;
  orderId: string;
  status: string;
}

export interface AdminReassignVendorOrderRequest {
  adminUserId: string;
  orderId: string;
}

export interface AdminForceCancelRefundOrderRequest {
  adminUserId: string;
  orderId: string;
}

export interface AdminRestartOrderDispatchRequest {
  adminUserId: string;
  orderId: string;
}

export const adminApi = {
  // Vendors
  async getVendors(): Promise<VendorDto[]> {
    return apiClient.get<VendorDto[]>('/admin/vendors');
  },

  async getVendorProfile(vendorId: string): Promise<VendorProfileDto> {
    return apiClient.get<VendorProfileDto>(`/vendors/${vendorId}/profile`);
  },

  async getVendorDocuments(vendorId: string): Promise<VendorDocumentDto[]> {
    return apiClient.get<VendorDocumentDto[]>(`/vendors/${vendorId}/documents`);
  },

  async getVendorBankAccounts(vendorId: string): Promise<VendorBankAccountDto[]> {
    return apiClient.get<VendorBankAccountDto[]>(`/vendors/${vendorId}/bank-accounts`);
  },

  async getVendorServiceAreas(vendorId: string): Promise<VendorServiceAreaDto[]> {
    return apiClient.get<VendorServiceAreaDto[]>(`/vendors/${vendorId}/service-areas`);
  },

  async getVendorWorkingHours(vendorId: string): Promise<VendorWorkingHourDto[]> {
    return apiClient.get<VendorWorkingHourDto[]>(`/vendors/${vendorId}/working-hours`);
  },

  async getVendorProductListings(vendorId: string): Promise<VendorProductListingDto[]> {
    return apiClient.get<VendorProductListingDto[]>(`/vendors/${vendorId}/listings`);
  },

  // Admin Users
  async getAdminUsers(): Promise<AdminUserDto[]> {
    return apiClient.get<AdminUserDto[]>('/admin/users');
  },

  async registerAdminUser(data: RegisterAdminUserRequest): Promise<AdminUserDto> {
    return apiClient.post<AdminUserDto>('/admin/users', data);
  },

  async updateAdminUser(adminId: string, data: {
    fullName?: string;
    email?: string;
    role?: string;
    roleId?: string;
    isActive?: boolean;
  }): Promise<AdminUserDto> {
    return apiClient.patch<AdminUserDto>(`/admin/users/${adminId}`, data);
  },

  async updateOwnAdminProfile(data: {
    fullName?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<AdminUserDto> {
    return apiClient.patch<AdminUserDto>('/admin/me', data);
  },

  async forceResetAdminPassword(
    adminId: string,
    data?: { newPassword?: string; notes?: string },
  ): Promise<ForceResetAdminPasswordDto> {
    return apiClient.patch<ForceResetAdminPasswordDto>(
      `/admin/users/${adminId}/password/reset`,
      data ?? {},
    );
  },

  // Audit Logs
  async getAuditLogs(adminUserId?: string): Promise<AdminAuditLogDto[]> {
    const url = adminUserId ? `/admin/audit-logs?adminUserId=${adminUserId}` : '/admin/audit-logs';
    return apiClient.get<AdminAuditLogDto[]>(url);
  },

  async addAuditLog(data: AddAdminAuditLogRequest): Promise<AdminAuditLogDto> {
    return apiClient.post<AdminAuditLogDto>('/admin/audit-logs', data);
  },

  // Vendor Verification
  async verifyVendorBankAccount(data: VerifyVendorBankAccountRequest): Promise<VendorBankAccountDto> {
    return apiClient.patch<VendorBankAccountDto>(
      `/admin/vendors/${data.vendorId}/bank-accounts/${data.bankAccountId}/verification`,
      data
    );
  },

  async verifyVendorDocument(data: VerifyVendorDocumentRequest): Promise<VendorDocumentDto> {
    return apiClient.patch<VendorDocumentDto>(
      `/admin/vendors/${data.vendorId}/documents/${data.documentId}/verification`,
      data
    );
  },

  async verifyVendorListing(data: VerifyVendorListingRequest): Promise<VendorProductListingDto> {
    return apiClient.patch<VendorProductListingDto>(
      `/admin/vendors/${data.vendorId}/listings/${data.listingId}/verification`,
      data
    );
  },

  // Vendor Password Reset
  async forceResetVendorPassword(data: ForceResetVendorPasswordRequest): Promise<AdminPasswordResetDto> {
    return apiClient.patch<AdminPasswordResetDto>(
      `/admin/vendors/${data.vendorId}/password/reset`,
      data
    );
  },

  async approveVendor(data: ApproveVendorRequest): Promise<VendorDto> {
    return apiClient.patch<VendorDto>(`/admin/vendors/${data.vendorId}/approve`, data);
  },

  async rejectVendor(data: RejectVendorRequest): Promise<VendorDto> {
    return apiClient.patch<VendorDto>(`/admin/vendors/${data.vendorId}/reject`, data);
  },

  async suspendVendor(data: SuspendVendorRequest): Promise<VendorDto> {
    return apiClient.patch<VendorDto>(`/admin/vendors/${data.vendorId}/suspend`, data);
  },

  async banVendor(data: BanVendorRequest): Promise<VendorDto> {
    return apiClient.patch<VendorDto>(`/admin/vendors/${data.vendorId}/ban`, data);
  },

  async reactivateVendor(data: ReactivateVendorRequest): Promise<VendorDto> {
    return apiClient.patch<VendorDto>(`/admin/vendors/${data.vendorId}/reactivate`, data);
  },

  // Catalog Management
  async getProductCategories(): Promise<ProductCategoryDto[]> {
    return apiClient.get<ProductCategoryDto[]>('/admin/catalog/categories');
  },

  async createProductCategory(data: CreateProductCategoryRequest): Promise<ProductCategoryDto> {
    return apiClient.post<ProductCategoryDto>('/admin/catalog/categories', data);
  },

  async updateProductCategory(id: string, data: UpdateProductCategoryRequest): Promise<ProductCategoryDto> {
    return apiClient.put<ProductCategoryDto>(`/admin/catalog/categories/${id}`, data);
  },

  async deleteProductCategory(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/catalog/categories/${id}`);
  },

  async getProducts(categoryId?: string): Promise<ProductDto[]> {
    const url = categoryId ? `/admin/catalog/products?categoryId=${categoryId}` : '/admin/catalog/products';
    return apiClient.get<ProductDto[]>(url);
  },

  async createProduct(data: CreateProductRequest): Promise<ProductDto> {
    return apiClient.post<ProductDto>('/admin/catalog/products', data);
  },

  async updateProduct(id: string, data: UpdateProductRequest): Promise<ProductDto> {
    return apiClient.put<ProductDto>(`/admin/catalog/products/${id}`, data);
  },

  async deleteProduct(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/catalog/products/${id}`);
  },

  async uploadProductImageFile(file: File): Promise<UploadedFileResponse> {
    const data = new FormData();
    data.append("vendorId", "common");
    data.append("file", file);
    data.append("folderType", "ProductImages");
    return apiClient.postForm<UploadedFileResponse>("/files/upload", data);
  },

  async getProductImages(productId: string): Promise<ProductImageDto[]> {
    return apiClient.get<ProductImageDto[]>(`/admin/catalog/products/${productId}/images`);
  },

  async addProductImage(productId: string, data: AddProductImageRequest): Promise<ProductImageDto> {
    return apiClient.post<ProductImageDto>(`/admin/catalog/products/${productId}/images`, {
      productId,
      ...data,
    });
  },

  async deleteProductImage(productId: string, imageId: string): Promise<void> {
    return apiClient.delete<void>(`/admin/catalog/products/${productId}/images/${imageId}`);
  },

  async setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
    return apiClient.patch<void>(`/admin/catalog/products/${productId}/images/${imageId}/primary`, {
      productId,
      imageId,
    });
  },

  async uploadCatalogExcel(file: File, isChemical: boolean = false): Promise<ExcelUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postForm<ExcelUploadResponseDto>(`/admin/catalog/upload-excel?isChemical=${isChemical}`, formData);
  },

  async downloadCatalogExcel(isChemical: boolean = false): Promise<void> {
    const filename = `catalog_${isChemical ? 'chemical' : 'equipment'}_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_")}.xlsx`;
    return apiClient.downloadBlob(`/admin/catalog/download-excel?isChemical=${isChemical}`, filename);
  },

  async getAdminOrders(): Promise<AdminOrderDto[]> {
    return apiClient.get<AdminOrderDto[]>('/admin/orders');
  },

  async updateAdminOrderStatus(data: UpdateAdminOrderStatusRequest): Promise<AdminOrderDto> {
    return apiClient.patch<AdminOrderDto>(`/admin/orders/${data.orderId}/status`, data);
  },

  async reassignVendorOrder(data: AdminReassignVendorOrderRequest): Promise<AdminOrderDto> {
    return apiClient.post<AdminOrderDto>(`/admin/orders/${data.orderId}/reassign`, data);
  },

  async forceCancelRefundOrder(data: AdminForceCancelRefundOrderRequest): Promise<AdminOrderDto> {
    return apiClient.post<AdminOrderDto>(`/admin/orders/${data.orderId}/cancel-refund`, data);
  },

  async restartOrderDispatch(data: AdminRestartOrderDispatchRequest): Promise<AdminOrderDto> {
    return apiClient.post<AdminOrderDto>(`/admin/orders/${data.orderId}/restart-dispatch`, data);
  },

  async getAdminOrderContinuations(orderId: string): Promise<import('./vendorOnboardingApi').OrderContinuationsDto> {
    return apiClient.get<import('./vendorOnboardingApi').OrderContinuationsDto>(`/admin/orders/${orderId}/continuations`);
  },

  async getAdminAllPendingContinuations(): Promise<any[]> {
    return apiClient.get<any[]>(`/admin/orders/continuations/pending`);
  },

  async approveAdminExtension(orderId: string, extensionId: string, adminUserId: string, overrides?: any): Promise<void> {
    const payload = { adminUserId, ...overrides };
    return apiClient.post(`/admin/orders/${orderId}/extensions/${extensionId}/approve`, payload);
  },

  async cancelAdminExtension(orderId: string, extensionId: string, adminUserId: string): Promise<void> {
    return apiClient.post(`/admin/orders/${orderId}/extensions/${extensionId}/cancel`, { adminUserId });
  },

  async approveAdminBuyout(orderId: string, buyoutId: string, adminUserId: string, overrides?: any): Promise<void> {
    const payload = { adminUserId, ...overrides };
    return apiClient.post(`/admin/orders/${orderId}/buyouts/${buyoutId}/approve`, payload);
  },

  async cancelAdminBuyout(orderId: string, buyoutId: string, adminUserId: string): Promise<void> {
    return apiClient.post(`/admin/orders/${orderId}/buyouts/${buyoutId}/cancel`, { adminUserId });
  },

  async getAdminRoles(): Promise<AdminRoleDto[]> {
    return apiClient.get<AdminRoleDto[]>("/admin/roles");
  },

  async getAdminPermissions(): Promise<AdminPermissionDto[]> {
    return apiClient.get<AdminPermissionDto[]>("/admin/permissions");
  },

  async createAdminRole(data: { code: string; name: string; description?: string; permissionCodes: string[] }): Promise<AdminRoleDto> {
    return apiClient.post<AdminRoleDto>("/admin/roles", data);
  },

  async updateAdminRole(roleId: string, data: { name: string; description?: string; isActive: boolean; permissionCodes: string[] }): Promise<AdminRoleDto> {
    return apiClient.put<AdminRoleDto>(`/admin/roles/${roleId}`, data);
  },

  async getAdminCustomers(search?: string): Promise<AdminCustomerListItemDto[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiClient.get<AdminCustomerListItemDto[]>(`/admin/customers${q}`);
  },

  async getAdminCustomer(customerId: string): Promise<AdminCustomerDetailDto> {
    return apiClient.get<AdminCustomerDetailDto>(`/admin/customers/${customerId}`);
  },

  async searchOrderableListings(search?: string, take = 40, isChemical?: boolean): Promise<AdminOrderableListingDto[]> {
    const params = new URLSearchParams();
    if (search?.trim()) params.set("search", search.trim());
    params.set("take", String(take));
    if (typeof isChemical === "boolean") params.set("isChemical", String(isChemical));
    return apiClient.get<AdminOrderableListingDto[]>(`/admin/orderable-listings?${params.toString()}`);
  },

  async placeOrderForCustomer(customerId: string, data: {
    customerAddressId?: string;
    deliveryOption: string;
    lines: {
      listingId: string;
      quantity: number;
      rentalDays: number;
      rentalPeriodUnit?: "day" | "week" | "month";
      orderType: string;
      productVariantId?: string;
      doctorId?: string;
      hospitalId?: string;
      contactNumber?: string;
      referenceNumber?: string;
    }[];
  }): Promise<{
    placedOrders: { id: string; orderNumber: string; listingTitle?: string }[];
    failedLines: { listingId: string; reasonCode: string; message: string }[];
  }> {
    return apiClient.post(`/admin/customers/${customerId}/orders`, data);
  },

  async impersonateVendor(vendorId: string): Promise<VendorImpersonationStartDto> {
    return apiClient.post<VendorImpersonationStartDto>(`/admin/vendors/${vendorId}/impersonate`, { vendorId });
  },

  async impersonateCustomer(customerId: string): Promise<PortalImpersonationStartDto> {
    return apiClient.post<PortalImpersonationStartDto>(`/admin/customers/${customerId}/impersonate`, { customerId });
  },

  // Doctors (Admin-owned medical directory)
  async getDoctors(search?: string, isActive?: boolean): Promise<AdminDoctorDto[]> {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set("search", search.trim());
    if (typeof isActive === "boolean") qs.set("isActive", String(isActive));
    const q = qs.toString();
    return apiClient.get<AdminDoctorDto[]>(`/admin/doctors${q ? `?${q}` : ""}`);
  },

  async getDoctor(id: string): Promise<AdminDoctorDto> {
    return apiClient.get<AdminDoctorDto>(`/admin/doctors/${id}`);
  },

  async createDoctor(data: CreateAdminDoctorRequest): Promise<AdminDoctorDto> {
    return apiClient.post<AdminDoctorDto>("/admin/doctors", data);
  },

  async updateDoctor(id: string, data: UpdateAdminDoctorRequest): Promise<AdminDoctorDto> {
    return apiClient.put<AdminDoctorDto>(`/admin/doctors/${id}`, { ...data, id });
  },

  async deleteDoctor(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/doctors/${id}`);
  },

  async resendDoctorEmail(id: string): Promise<void> {
    return apiClient.post<void>(`/admin/doctors/${id}/resend-email`, {});
  },

  async downloadDoctorQr(id: string, uniqueCode: string): Promise<void> {
    return apiClient.downloadBlob(`/admin/doctors/${id}/qr.png`, `doctor-${uniqueCode}-qr.png`);
  },

  async getDoctorQrObjectUrl(id: string): Promise<string> {
    const blob = await apiClient.fetchBlob(`/admin/doctors/${id}/qr.png`);
    return URL.createObjectURL(blob);
  },

  async getHospitals(search?: string, isActive?: boolean): Promise<AdminHospitalDto[]> {
    const qs = new URLSearchParams();
    if (search?.trim()) qs.set("search", search.trim());
    if (typeof isActive === "boolean") qs.set("isActive", String(isActive));
    const q = qs.toString();
    return apiClient.get<AdminHospitalDto[]>(`/admin/hospitals${q ? `?${q}` : ""}`);
  },

  async createHospital(data: CreateAdminHospitalRequest): Promise<AdminHospitalDto> {
    return apiClient.post<AdminHospitalDto>("/admin/hospitals", data);
  },

  async updateHospital(id: string, data: UpdateAdminHospitalRequest): Promise<AdminHospitalDto> {
    return apiClient.put<AdminHospitalDto>(`/admin/hospitals/${id}`, { ...data, id });
  },

  async deleteHospital(id: string): Promise<void> {
    return apiClient.delete<void>(`/admin/hospitals/${id}`);
  },
};
