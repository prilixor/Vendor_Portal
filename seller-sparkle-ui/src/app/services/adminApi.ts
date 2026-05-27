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
  monthlyRent: number;
  securityDeposit: number;
  availableQuantity: number;
  listingStatus: string;
}

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface RegisterAdminUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: string;
  isActive?: boolean;
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
  monthlyRent: number;
  securityDeposit: number;
  availableQuantity: number;
  listingStatus: string;
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
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  gstPercent: number;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  isActive: boolean;
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
  isActive: boolean;
}

export interface UpdateProductCategoryRequest {
  id: string;
  categoryName: string;
  prescriptionRequired: boolean;
  depositRequired: boolean;
  installationRequired: boolean;
  isActive: boolean;
}

export interface CreateProductRequest {
  categoryId: string;
  productName: string;
  brandName?: string;
  modelName?: string;
  shortDescription?: string;
  longDescription?: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  gstPercent: number;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  isActive: boolean;
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
  monthlyRent: number;
  securityDeposit: number;
  buyPrice?: number;
  gstPercent: number;
  isRentEnabled: boolean;
  isBuyEnabled: boolean;
  isActive: boolean;
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

  async uploadCatalogExcel(file: File): Promise<ExcelUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.postForm<ExcelUploadResponseDto>('/admin/catalog/upload-excel', formData);
  },

  async downloadCatalogExcel(): Promise<void> {
    const filename = `catalog_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_")}.xlsx`;
    return apiClient.downloadBlob('/admin/catalog/download-excel', filename);
  },
};
