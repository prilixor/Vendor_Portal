import {
  AdminUser,
  AuditLog,
  AvailabilityOverride,
  BankDetails,
  BusinessProfile,
  InventoryMovement,
  InventoryRecord,
  Notification,
  ProductListing,
  ServiceArea,
  Vendor,
  VendorDocument,
  WorkingHour,
} from "@/app/models";

export const mockBusinessProfile: BusinessProfile = {
  businessName: "Acme Rentals Pvt Ltd",
  ownerName: "Priya Sharma",
  phone: "+91 98765 43210",
  gstNumber: "27AABCU9603R1ZX",
  addressLine1: "204, Business Hub, MG Road",
  addressLine2: "Near Metro Station",
  city: "Mumbai",
  state: "Maharashtra",
  postalCode: "400001",
  latitude: 19.076,
  longitude: 72.8777,
};

export const mockDocuments: VendorDocument[] = [
  { id: "d1", vendorId: "v1", type: "GST Certificate", fileName: "gst-cert.pdf", status: "approved", uploadedAt: "2025-03-12" },
  { id: "d2", vendorId: "v1", type: "PAN Card", fileName: "pan.pdf", status: "approved", uploadedAt: "2025-03-12" },
  { id: "d3", vendorId: "v1", type: "Trade License", fileName: "license.pdf", status: "pending", uploadedAt: "2025-04-02" },
  { id: "d4", vendorId: "v1", type: "Address Proof", fileName: "utility-bill.pdf", status: "rejected", rejectionReason: "Document is older than 3 months. Please upload a recent copy.", uploadedAt: "2025-03-20" },
];

export const mockBankDetails: BankDetails = {
  accountHolderName: "Acme Rentals Pvt Ltd",
  bankName: "HDFC Bank",
  accountNumber: "50100123456789",
  ifscCode: "HDFC0001234",
  status: "approved",
};

export const mockServiceAreas: ServiceArea[] = [
  { id: "sa1", name: "South Mumbai", city: "Mumbai", latitude: 18.94, longitude: 72.83, radiusKm: 8 },
  { id: "sa2", name: "Bandra & Western Suburbs", city: "Mumbai", latitude: 19.06, longitude: 72.83, radiusKm: 12 },
  { id: "sa3", name: "Thane Central", city: "Thane", latitude: 19.21, longitude: 72.97, radiusKm: 10 },
];

export const mockWorkingHours: WorkingHour[] = [
  { day: "mon", open: true, openTime: "09:00", closeTime: "19:00" },
  { day: "tue", open: true, openTime: "09:00", closeTime: "19:00" },
  { day: "wed", open: true, openTime: "09:00", closeTime: "19:00" },
  { day: "thu", open: true, openTime: "09:00", closeTime: "19:00" },
  { day: "fri", open: true, openTime: "09:00", closeTime: "19:00" },
  { day: "sat", open: true, openTime: "10:00", closeTime: "16:00" },
  { day: "sun", open: false, openTime: "10:00", closeTime: "16:00" },
];

export const mockOverrides: AvailabilityOverride[] = [
  { id: "ov1", date: "2025-04-25", available: false, reason: "Annual stocktake" },
  { id: "ov2", date: "2025-05-01", available: false, reason: "Public holiday" },
  { id: "ov3", date: "2025-05-15", available: true, startTime: "12:00", endTime: "20:00", reason: "Extended hours for festive demand" },
];

export const mockProducts: ProductListing[] = [
  { id: "p1", category: "Power Tools", productName: "Bosch GSB 550 Drill", title: "Bosch 550W Impact Drill — Daily Rental", dailyRent: 350, monthlyRent: 6500, securityDeposit: 4000, quantity: 12, status: "active", images: [], createdAt: "2025-02-10" },
  { id: "p2", category: "Camping", productName: "4-Person Tent", title: "Quechua Arpenaz 4-Person Tent", dailyRent: 450, monthlyRent: 8000, securityDeposit: 5000, quantity: 8, status: "active", images: [], createdAt: "2025-02-22" },
  { id: "p3", category: "Photography", productName: "Sony A7 III Body", title: "Sony A7 III Mirrorless Camera Body", dailyRent: 1500, monthlyRent: 28000, securityDeposit: 30000, quantity: 4, status: "active", images: [], createdAt: "2025-03-04" },
  { id: "p4", category: "Cleaning Equipment", productName: "Karcher Pressure Washer", title: "Karcher K3 High-Pressure Washer", dailyRent: 600, monthlyRent: 11000, securityDeposit: 7000, quantity: 6, status: "draft", images: [], createdAt: "2025-04-01" },
  { id: "p5", category: "Event Equipment", productName: "JBL PA Speaker", title: "JBL EON 615 Powered PA Speaker", dailyRent: 800, monthlyRent: 15000, securityDeposit: 10000, quantity: 10, status: "active", images: [], createdAt: "2025-03-18" },
];

export const mockInventory: InventoryRecord[] = mockProducts.map((p) => {
  const rented = Math.floor(p.quantity * 0.3);
  const reserved = Math.floor(p.quantity * 0.15);
  const blocked = Math.floor(p.quantity * 0.05);
  return {
    productId: p.id,
    productName: p.productName,
    total: p.quantity,
    rented,
    reserved,
    blocked,
    available: p.quantity - rented - reserved - blocked,
  };
});

export const mockMovements: InventoryMovement[] = [
  { id: "m1", productName: "Bosch GSB 550 Drill", type: "out", quantity: 2, reference: "ORD-10241", timestamp: "2025-04-18T09:24:00Z" },
  { id: "m2", productName: "Sony A7 III Body", type: "reserved", quantity: 1, reference: "ORD-10243", timestamp: "2025-04-18T11:02:00Z" },
  { id: "m3", productName: "JBL PA Speaker", type: "in", quantity: 4, reference: "RTN-2231", timestamp: "2025-04-17T17:45:00Z" },
  { id: "m4", productName: "Quechua Arpenaz 4-Person Tent", type: "blocked", quantity: 1, reference: "MAINT-882", timestamp: "2025-04-17T08:10:00Z" },
  { id: "m5", productName: "Karcher Pressure Washer", type: "released", quantity: 1, reference: "ORD-10221", timestamp: "2025-04-16T15:30:00Z" },
];

export const mockNotifications: Notification[] = [
  { id: "n1", title: "Document approved", message: "Your GST Certificate has been verified by the admin team.", type: "success", read: false, timestamp: "2025-04-18T10:00:00Z" },
  { id: "n2", title: "New rental request", message: "ORD-10241 received for Bosch GSB 550 Drill (2 units).", type: "info", read: false, timestamp: "2025-04-18T09:24:00Z" },
  { id: "n3", title: "Low stock warning", message: "Karcher Pressure Washer has only 2 units available.", type: "warning", read: true, timestamp: "2025-04-17T22:12:00Z" },
  { id: "n4", title: "Document rejected", message: "Address Proof was rejected. Please re-upload a recent copy.", type: "error", read: true, timestamp: "2025-04-17T08:00:00Z" },
  { id: "n5", title: "Payout processed", message: "₹42,300 has been credited to your bank account.", type: "success", read: true, timestamp: "2025-04-15T13:40:00Z" },
];

export const mockVendors: Vendor[] = [
  { id: "v1", email: "priya@acmerentals.in", businessName: "Acme Rentals Pvt Ltd", ownerName: "Priya Sharma", city: "Mumbai", status: "approved", joinedAt: "2025-01-12", documentsCount: 4, productsCount: 12 },
  { id: "v2", email: "raj@gearhub.in", businessName: "GearHub India", ownerName: "Raj Mehta", city: "Bengaluru", status: "under_review", joinedAt: "2025-04-10", documentsCount: 3, productsCount: 0 },
  { id: "v3", email: "neha@eventpro.in", businessName: "EventPro Solutions", ownerName: "Neha Kapoor", city: "Delhi", status: "pending", joinedAt: "2025-04-15", documentsCount: 2, productsCount: 0 },
  { id: "v4", email: "arjun@toolsmart.in", businessName: "ToolSmart", ownerName: "Arjun Verma", city: "Pune", status: "rejected", joinedAt: "2025-04-08", documentsCount: 4, productsCount: 0 },
  { id: "v5", email: "sara@campwise.in", businessName: "CampWise Outdoors", ownerName: "Sara Khan", city: "Goa", status: "approved", joinedAt: "2025-02-28", documentsCount: 4, productsCount: 8 },
  { id: "v6", email: "vikram@studio9.in", businessName: "Studio 9 Rentals", ownerName: "Vikram Singh", city: "Hyderabad", status: "under_review", joinedAt: "2025-04-12", documentsCount: 4, productsCount: 0 },
];

export const mockAdmins: AdminUser[] = [
  { id: "a1", name: "Anita Desai", email: "anita@portal.com", role: "super_admin", lastActive: "2025-04-19T08:30:00Z" },
  { id: "a2", name: "Karthik Iyer", email: "karthik@portal.com", role: "verifier", lastActive: "2025-04-19T07:50:00Z" },
  { id: "a3", name: "Meera Joshi", email: "meera@portal.com", role: "support", lastActive: "2025-04-18T18:15:00Z" },
];

export const mockAuditLogs: AuditLog[] = [
  { id: "l1", action: "VENDOR_APPROVED", entityType: "Vendor", entityId: "v1", actor: "Anita Desai", oldValue: "under_review", newValue: "approved", timestamp: "2025-04-19T08:30:00Z" },
  { id: "l2", action: "DOCUMENT_REJECTED", entityType: "Document", entityId: "d4", actor: "Karthik Iyer", oldValue: "pending", newValue: "rejected", timestamp: "2025-04-18T16:12:00Z" },
  { id: "l3", action: "ADMIN_CREATED", entityType: "Admin", entityId: "a3", actor: "Anita Desai", newValue: "Meera Joshi (support)", timestamp: "2025-04-17T11:00:00Z" },
  { id: "l4", action: "VENDOR_REJECTED", entityType: "Vendor", entityId: "v4", actor: "Karthik Iyer", oldValue: "under_review", newValue: "rejected", timestamp: "2025-04-15T09:42:00Z" },
  { id: "l5", action: "DOCUMENT_APPROVED", entityType: "Document", entityId: "d1", actor: "Karthik Iyer", oldValue: "pending", newValue: "approved", timestamp: "2025-04-14T14:22:00Z" },
];


