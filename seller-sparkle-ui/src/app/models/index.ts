export type Role = "vendor" | "admin" | "super_admin" | "verifier" | "operations_admin";

export type VerificationStatus = "pending" | "approved" | "rejected" | "under_review";

export type AccountStatus = "pending" | "active" | "suspended" | "banned" | "rejected";

export type RegistrationStage = "email_registered" | "profile_pending" | "documents_pending" | "under_review" | "approved" | "rejected";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  phone: string;
  gstNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export interface VendorDocument {
  id: string;
  vendorId: string;
  type: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  status: VerificationStatus;
  rejectionReason?: string;
  uploadedAt: string;
}

export interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  branchName: string;
  ifscCode: string;
  status: VerificationStatus;
}

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface WorkingHour {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: boolean;
  openTime: string;
  closeTime: string;
}

export interface AvailabilityOverride {
  id: string;
  date: string; // ISO date
  available: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

export type ProductStatus = "draft" | "active" | "inactive";

export interface ProductListing {
  id: string;
  category: string;
  productName: string;
  title: string;
  dailyRent: number;
  monthlyRent: number;
  securityDeposit: number;
  quantity: number;
  status: ProductStatus;
  primaryImage?: string;
  images: string[];
  createdAt: string;
}

export interface InventoryRecord {
  productId: string;
  productName: string;
  total: number;
  available: number;
  reserved: number;
  rented: number;
  blocked: number;
}

export interface InventoryMovement {
  id: string;
  productName: string;
  type: "stock_added" | "stock_removed" | "reserved" | "reservation_released" | "rented" | "returned" | "blocked" | "unblocked" | "corrected" | "in" | "out" | "released";
  quantity: number;
  reference: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  timestamp: string;
}

export interface Vendor {
  id: string;
  email: string;
  businessName: string;
  ownerName: string;
  city: string;
  status: VerificationStatus;
  joinedAt: string;
  documentsCount: number;
  productsCount: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "verifier" | "support";
  lastActive: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}
