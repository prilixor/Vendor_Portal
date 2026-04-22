using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.VendorPortal.Domain.Auth;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IVendorOnboardingRepository
{
    Task<Vendor?> GetVendorByIdAsync(Guid vendorId, CancellationToken cancellationToken);
    Task<Vendor?> GetVendorByEmailAsync(string email, CancellationToken cancellationToken);
    Task AddVendorAsync(Vendor vendor, CancellationToken cancellationToken);
    Task UpdateVendorAsync(Vendor vendor, CancellationToken cancellationToken);

    Task<VendorProfile?> GetVendorProfileAsync(Guid vendorId, CancellationToken cancellationToken);
    Task UpsertVendorProfileAsync(VendorProfile profile, CancellationToken cancellationToken);

    Task AddVendorDocumentAsync(VendorDocument document, CancellationToken cancellationToken);
    Task<List<VendorDocument>> GetVendorDocumentsAsync(Guid vendorId, CancellationToken cancellationToken);
    Task<VendorDocument?> GetVendorDocumentByIdAsync(Guid vendorId, Guid documentId, CancellationToken cancellationToken);
    Task UpdateVendorDocumentAsync(VendorDocument document, CancellationToken cancellationToken);

    Task AddVerificationRequestAsync(VendorVerificationRequest request, CancellationToken cancellationToken);
    Task<List<VendorVerificationRequest>> GetVerificationRequestsAsync(Guid vendorId, CancellationToken cancellationToken);

    Task AddVendorServiceAreaAsync(VendorServiceArea serviceArea, CancellationToken cancellationToken);
    Task<VendorServiceArea?> GetVendorServiceAreaByIdAsync(Guid vendorId, Guid serviceAreaId, CancellationToken cancellationToken);
    Task<List<VendorServiceArea>> GetVendorServiceAreasAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<VendorWorkingHour?> GetVendorWorkingHourByDayAsync(Guid vendorId, short dayOfWeek, CancellationToken cancellationToken);
    Task UpsertVendorWorkingHourAsync(VendorWorkingHour workingHour, CancellationToken cancellationToken);
    Task<List<VendorWorkingHour>> GetVendorWorkingHoursAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<VendorAvailabilityOverride?> GetVendorAvailabilityOverrideByDateAsync(Guid vendorId, DateOnly overrideDate, CancellationToken cancellationToken);
    Task<VendorAvailabilityOverride?> GetVendorAvailabilityOverrideByIdAsync(Guid vendorId, Guid overrideId, CancellationToken cancellationToken);
    Task UpsertVendorAvailabilityOverrideAsync(VendorAvailabilityOverride availabilityOverride, CancellationToken cancellationToken);
    Task<List<VendorAvailabilityOverride>> GetVendorAvailabilityOverridesAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<VendorBankAccount?> GetVendorBankAccountByIdAsync(Guid vendorId, Guid bankAccountId, CancellationToken cancellationToken);
    Task AddVendorBankAccountAsync(VendorBankAccount bankAccount, CancellationToken cancellationToken);
    Task UpdateVendorBankAccountAsync(VendorBankAccount bankAccount, CancellationToken cancellationToken);
    Task<List<VendorBankAccount>> GetVendorBankAccountsAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<ProductCategory?> GetProductCategoryByIdAsync(Guid categoryId, CancellationToken cancellationToken);
    Task AddProductCategoryAsync(ProductCategory category, CancellationToken cancellationToken);
    Task<List<ProductCategory>> GetProductCategoriesAsync(CancellationToken cancellationToken);

    Task<Product?> GetProductByIdAsync(Guid productId, CancellationToken cancellationToken);
    Task AddProductAsync(Product product, CancellationToken cancellationToken);
    Task<List<Product>> GetProductsAsync(Guid? categoryId, CancellationToken cancellationToken);

    Task<VendorProductListing?> GetVendorProductListingByIdAsync(Guid vendorId, Guid listingId, CancellationToken cancellationToken);
    Task<VendorProductListing?> GetVendorProductListingByVendorProductAsync(Guid vendorId, Guid productId, CancellationToken cancellationToken);
    Task AddVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken);
    Task UpdateVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken);
    Task<List<VendorProductListing>> GetVendorProductListingsAsync(Guid vendorId, CancellationToken cancellationToken);

    Task AddVendorProductImageAsync(VendorProductImage image, CancellationToken cancellationToken);
    Task<List<VendorProductImage>> GetVendorProductImagesAsync(Guid listingId, CancellationToken cancellationToken);

    Task AddVendorProductDocumentAsync(VendorProductDocument document, CancellationToken cancellationToken);
    Task<VendorProductDocument?> GetVendorProductDocumentByIdAsync(Guid vendorId, Guid listingId, Guid documentId, CancellationToken cancellationToken);
    Task UpdateVendorProductDocumentAsync(VendorProductDocument document, CancellationToken cancellationToken);
    Task<List<VendorProductDocument>> GetVendorProductDocumentsAsync(Guid listingId, CancellationToken cancellationToken);

    Task<VendorInventory?> GetVendorInventoryByListingIdAsync(Guid listingId, CancellationToken cancellationToken);
    Task UpsertVendorInventoryAsync(VendorInventory inventory, CancellationToken cancellationToken);

    Task AddVendorInventoryMovementAsync(VendorInventoryMovement movement, CancellationToken cancellationToken);
    Task<List<VendorInventoryMovement>> GetVendorInventoryMovementsAsync(Guid inventoryId, CancellationToken cancellationToken);

    Task<VendorNotificationPreference?> GetVendorNotificationPreferenceAsync(Guid vendorId, CancellationToken cancellationToken);
    Task UpsertVendorNotificationPreferenceAsync(VendorNotificationPreference preference, CancellationToken cancellationToken);

    Task AddVendorNotificationAsync(VendorNotification notification, CancellationToken cancellationToken);
    Task<VendorNotification?> GetVendorNotificationByIdAsync(Guid vendorId, Guid notificationId, CancellationToken cancellationToken);
    Task UpdateVendorNotificationAsync(VendorNotification notification, CancellationToken cancellationToken);
    Task<List<VendorNotification>> GetVendorNotificationsAsync(Guid vendorId, CancellationToken cancellationToken);

    Task<AdminUser?> GetAdminUserByIdAsync(Guid adminUserId, CancellationToken cancellationToken);
    Task<AdminUser?> GetAdminUserByEmailAsync(string email, CancellationToken cancellationToken);
    Task AddAdminUserAsync(AdminUser adminUser, CancellationToken cancellationToken);
    Task<List<AdminUser>> GetAdminUsersAsync(CancellationToken cancellationToken);

    Task AddAdminAuditLogAsync(AdminAuditLog auditLog, CancellationToken cancellationToken);
    Task<List<AdminAuditLog>> GetAdminAuditLogsAsync(Guid? adminUserId, CancellationToken cancellationToken);

    Task<PasswordResetToken?> GetPasswordResetTokenAsync(string token, CancellationToken cancellationToken);
    Task AddPasswordResetTokenAsync(PasswordResetToken token, CancellationToken cancellationToken);
    Task MarkPasswordResetTokenAsUsedAsync(string token, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
