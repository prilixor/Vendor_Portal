using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.Shared.Abstractions.DI;
using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public sealed class VendorOnboardingRepository(ApplicationDbContext dbContext)
    : IVendorOnboardingRepository, IScopedService
{
    public Task<Vendor?> GetVendorByIdAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.Vendors
            .FirstOrDefaultAsync(x => x.Id == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task<Vendor?> GetVendorByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return dbContext.Vendors
            .FirstOrDefaultAsync(x => x.Email == normalized && !x.IsDeleted, cancellationToken);
    }

    public Task<List<Vendor>> GetVendorsAsync(CancellationToken cancellationToken)
    {
        return dbContext.Vendors
            .Where(x => !x.IsDeleted)
            .ToListAsync(cancellationToken);
    }

    public async Task AddVendorAsync(Vendor vendor, CancellationToken cancellationToken)
    {
        await dbContext.Vendors.AddAsync(vendor, cancellationToken);
    }

    public Task UpdateVendorAsync(Vendor vendor, CancellationToken cancellationToken)
    {
        dbContext.Vendors.Update(vendor);
        return Task.CompletedTask;
    }

    public Task<VendorProfile?> GetVendorProfileAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProfiles
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorProfileAsync(VendorProfile profile, CancellationToken cancellationToken)
    {
        if (profile.Id == Guid.Empty)
        {
            await dbContext.VendorProfiles.AddAsync(profile, cancellationToken);
            return;
        }

        dbContext.VendorProfiles.Update(profile);
    }

    public async Task AddVendorDocumentAsync(VendorDocument document, CancellationToken cancellationToken)
    {
        await dbContext.VendorDocuments.AddAsync(document, cancellationToken);
    }

    public Task<List<VendorDocument>> GetVendorDocumentsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorDocuments
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> AreAllVendorDocumentsApprovedAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        var documents = await dbContext.VendorDocuments
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .ToListAsync(cancellationToken);

        if (documents.Count == 0) return false;

        return documents.All(d => d.VerificationStatus == "approved");
    }

    public Task<VendorDocument?> GetVendorDocumentByIdAsync(Guid vendorId, Guid documentId, CancellationToken cancellationToken)
    {
        return dbContext.VendorDocuments
            .FirstOrDefaultAsync(x => x.Id == documentId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task UpdateVendorDocumentAsync(VendorDocument document, CancellationToken cancellationToken)
    {
        dbContext.VendorDocuments.Update(document);
        return Task.CompletedTask;
    }

    public async Task AddVerificationRequestAsync(VendorVerificationRequest request, CancellationToken cancellationToken)
    {
        await dbContext.VendorVerificationRequests.AddAsync(request, cancellationToken);
    }

    public Task<List<VendorVerificationRequest>> GetVerificationRequestsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorVerificationRequests
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.SubmittedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddVendorServiceAreaAsync(VendorServiceArea serviceArea, CancellationToken cancellationToken)
    {
        await dbContext.VendorServiceAreas.AddAsync(serviceArea, cancellationToken);
    }

    public Task<VendorServiceArea?> GetVendorServiceAreaByIdAsync(Guid vendorId, Guid serviceAreaId, CancellationToken cancellationToken)
    {
        return dbContext.VendorServiceAreas
            .FirstOrDefaultAsync(x => x.Id == serviceAreaId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task<List<VendorServiceArea>> GetVendorServiceAreasAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorServiceAreas
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorWorkingHour?> GetVendorWorkingHourByDayAsync(Guid vendorId, short dayOfWeek, CancellationToken cancellationToken)
    {
        return dbContext.VendorWorkingHours
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && x.DayOfWeek == dayOfWeek && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorWorkingHourAsync(VendorWorkingHour workingHour, CancellationToken cancellationToken)
    {
        if (workingHour.Id == Guid.Empty)
        {
            await dbContext.VendorWorkingHours.AddAsync(workingHour, cancellationToken);
            return;
        }

        dbContext.VendorWorkingHours.Update(workingHour);
    }

    public Task<List<VendorWorkingHour>> GetVendorWorkingHoursAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorWorkingHours
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderBy(x => x.DayOfWeek)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorAvailabilityOverride?> GetVendorAvailabilityOverrideByDateAsync(Guid vendorId, DateOnly overrideDate, CancellationToken cancellationToken)
    {
        return dbContext.VendorAvailabilityOverrides
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && x.OverrideDate == overrideDate, cancellationToken);
    }

    public Task<VendorAvailabilityOverride?> GetVendorAvailabilityOverrideByIdAsync(Guid vendorId, Guid overrideId, CancellationToken cancellationToken)
    {
        return dbContext.VendorAvailabilityOverrides
            .FirstOrDefaultAsync(x => x.Id == overrideId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorAvailabilityOverrideAsync(VendorAvailabilityOverride availabilityOverride, CancellationToken cancellationToken)
    {
        if (availabilityOverride.Id == Guid.Empty)
        {
            await dbContext.VendorAvailabilityOverrides.AddAsync(availabilityOverride, cancellationToken);
            return;
        }

        dbContext.VendorAvailabilityOverrides.Update(availabilityOverride);
    }

    public Task<List<VendorAvailabilityOverride>> GetVendorAvailabilityOverridesAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorAvailabilityOverrides
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.OverrideDate)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorBankAccount?> GetVendorBankAccountByIdAsync(Guid vendorId, Guid bankAccountId, CancellationToken cancellationToken)
    {
        return dbContext.VendorBankAccounts
            .FirstOrDefaultAsync(x => x.Id == bankAccountId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddVendorBankAccountAsync(VendorBankAccount bankAccount, CancellationToken cancellationToken)
    {
        await dbContext.VendorBankAccounts.AddAsync(bankAccount, cancellationToken);
    }

    public Task UpdateVendorBankAccountAsync(VendorBankAccount bankAccount, CancellationToken cancellationToken)
    {
        dbContext.VendorBankAccounts.Update(bankAccount);
        return Task.CompletedTask;
    }

    public Task<List<VendorBankAccount>> GetVendorBankAccountsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorBankAccounts
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<ProductCategory?> GetProductCategoryByIdAsync(Guid categoryId, CancellationToken cancellationToken)
    {
        return dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddProductCategoryAsync(ProductCategory category, CancellationToken cancellationToken)
    {
        await dbContext.ProductCategories.AddAsync(category, cancellationToken);
    }

    public Task UpdateProductCategoryAsync(ProductCategory category, CancellationToken cancellationToken)
    {
        dbContext.ProductCategories.Update(category);
        return Task.CompletedTask;
    }

    public async Task DeleteProductCategoryAsync(Guid categoryId, CancellationToken cancellationToken)
    {
        var category = await dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);
        
        if (category != null)
        {
            category.IsDeleted = true;
            category.DeletedAt = DateTimeOffset.UtcNow;
            dbContext.ProductCategories.Update(category);
        }
    }

    public Task<List<ProductCategory>> GetProductCategoriesAsync(CancellationToken cancellationToken)
    {
        return dbContext.ProductCategories
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.CategoryName)
            .ToListAsync(cancellationToken);
    }

    public Task<Product?> GetProductByIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        return dbContext.Products
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddProductAsync(Product product, CancellationToken cancellationToken)
    {
        await dbContext.Products.AddAsync(product, cancellationToken);
    }

    public Task UpdateProductAsync(Product product, CancellationToken cancellationToken)
    {
        dbContext.Products.Update(product);
        return Task.CompletedTask;
    }

    public async Task DeleteProductAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await dbContext.Products
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);
        
        if (product != null)
        {
            product.IsDeleted = true;
            product.DeletedAt = DateTimeOffset.UtcNow;
            dbContext.Products.Update(product);
        }
    }

    public Task<List<Product>> GetProductsAsync(Guid? categoryId, CancellationToken cancellationToken)
    {
        var query = dbContext.Products
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == categoryId.Value);
        }

        return query.OrderBy(x => x.ProductName).ToListAsync(cancellationToken);
    }

    public Task<VendorProductListing?> GetVendorProductListingByIdAsync(Guid vendorId, Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .FirstOrDefaultAsync(x => x.Id == listingId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task<VendorProductListing?> GetVendorProductListingByVendorProductAsync(Guid vendorId, Guid productId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && x.ProductId == productId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken)
    {
        await dbContext.VendorProductListings.AddAsync(listing, cancellationToken);
    }

    public Task UpdateVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken)
    {
        dbContext.VendorProductListings.Update(listing);
        return Task.CompletedTask;
    }

    public Task<List<VendorProductListing>> GetVendorProductListingsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task AddVendorProductImageAsync(VendorProductImage image, CancellationToken cancellationToken)
    {
        await dbContext.VendorProductImages.AddAsync(image, cancellationToken);
    }

    public Task<VendorProductImage?> GetVendorProductImageByIdAsync(Guid vendorId, Guid listingId, Guid imageId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductImages
            .Where(x => x.Id == imageId && x.VendorProductListingId == listingId && !x.IsDeleted)
            .Join(
                dbContext.VendorProductListings.Where(l => l.VendorId == vendorId && !l.IsDeleted),
                img => img.VendorProductListingId,
                listing => listing.Id,
                (img, _) => img)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task UpdateVendorProductImageAsync(VendorProductImage image, CancellationToken cancellationToken)
    {
        dbContext.VendorProductImages.Update(image);
        return Task.CompletedTask;
    }

    public Task<List<VendorProductImage>> GetVendorProductImagesAsync(Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductImages
            .Where(x => x.VendorProductListingId == listingId && !x.IsDeleted)
            .OrderBy(x => x.DisplayOrder)
            .ToListAsync(cancellationToken);
    }

    public async Task AddVendorProductDocumentAsync(VendorProductDocument document, CancellationToken cancellationToken)
    {
        await dbContext.VendorProductDocuments.AddAsync(document, cancellationToken);
    }

    public Task<VendorProductDocument?> GetVendorProductDocumentByIdAsync(Guid vendorId, Guid listingId, Guid documentId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductDocuments
            .Where(x => x.Id == documentId && x.VendorProductListingId == listingId && !x.IsDeleted)
            .Join(
                dbContext.VendorProductListings.Where(l => l.VendorId == vendorId && !l.IsDeleted),
                doc => doc.VendorProductListingId,
                listing => listing.Id,
                (doc, _) => doc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public Task UpdateVendorProductDocumentAsync(VendorProductDocument document, CancellationToken cancellationToken)
    {
        dbContext.VendorProductDocuments.Update(document);
        return Task.CompletedTask;
    }

    public Task<List<VendorProductDocument>> GetVendorProductDocumentsAsync(Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductDocuments
            .Where(x => x.VendorProductListingId == listingId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorInventory?> GetVendorInventoryByListingIdAsync(Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorInventory
            .FirstOrDefaultAsync(x => x.VendorProductListingId == listingId && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorInventoryAsync(VendorInventory inventory, CancellationToken cancellationToken)
    {
        if (inventory.Id == Guid.Empty)
        {
            await dbContext.VendorInventory.AddAsync(inventory, cancellationToken);
            return;
        }

        dbContext.VendorInventory.Update(inventory);
    }

    public async Task AddVendorInventoryMovementAsync(VendorInventoryMovement movement, CancellationToken cancellationToken)
    {
        await dbContext.VendorInventoryMovements.AddAsync(movement, cancellationToken);
    }

    public Task<List<VendorInventoryMovement>> GetVendorInventoryMovementsAsync(Guid inventoryId, CancellationToken cancellationToken)
    {
        return dbContext.VendorInventoryMovements
            .Where(x => x.VendorInventoryId == inventoryId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorNotificationPreference?> GetVendorNotificationPreferenceAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorNotificationPreferences
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorNotificationPreferenceAsync(VendorNotificationPreference preference, CancellationToken cancellationToken)
    {
        if (preference.Id == Guid.Empty)
        {
            await dbContext.VendorNotificationPreferences.AddAsync(preference, cancellationToken);
            return;
        }

        dbContext.VendorNotificationPreferences.Update(preference);
    }

    public async Task AddVendorNotificationAsync(VendorNotification notification, CancellationToken cancellationToken)
    {
        await dbContext.VendorNotifications.AddAsync(notification, cancellationToken);
    }

    public Task<VendorNotification?> GetVendorNotificationByIdAsync(Guid vendorId, Guid notificationId, CancellationToken cancellationToken)
    {
        return dbContext.VendorNotifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task UpdateVendorNotificationAsync(VendorNotification notification, CancellationToken cancellationToken)
    {
        dbContext.VendorNotifications.Update(notification);
        return Task.CompletedTask;
    }

    public Task<List<VendorNotification>> GetVendorNotificationsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorNotifications
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<AdminUser?> GetAdminUserByIdAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        return dbContext.AdminUsers
            .FirstOrDefaultAsync(x => x.Id == adminUserId && !x.IsDeleted, cancellationToken);
    }

    public Task<AdminUser?> GetAdminUserByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return dbContext.AdminUsers
            .FirstOrDefaultAsync(x => x.Email == normalized && !x.IsDeleted, cancellationToken);
    }

    public async Task AddAdminUserAsync(AdminUser adminUser, CancellationToken cancellationToken)
    {
        await dbContext.AdminUsers.AddAsync(adminUser, cancellationToken);
    }

    public Task<List<AdminUser>> GetAdminUsersAsync(CancellationToken cancellationToken)
    {
        return dbContext.AdminUsers
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAdminAuditLogAsync(AdminAuditLog auditLog, CancellationToken cancellationToken)
    {
        await dbContext.AdminAuditLogs.AddAsync(auditLog, cancellationToken);
    }

    public Task<List<AdminAuditLog>> GetAdminAuditLogsAsync(Guid? adminId, CancellationToken cancellationToken)
    {
        var query = dbContext.AdminAuditLogs
            .Include(x => x.AdminUser)
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (adminId.HasValue && adminId.Value != Guid.Empty)
        {
            query = query.Where(x => x.AdminId == adminId.Value);
        }

        return query
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<PasswordResetToken?> GetPasswordResetTokenAsync(string token, CancellationToken cancellationToken)
    {
        return dbContext.PasswordResetTokens
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
    }

    public async Task AddPasswordResetTokenAsync(PasswordResetToken token, CancellationToken cancellationToken)
    {
        await dbContext.PasswordResetTokens.AddAsync(token, cancellationToken);
    }

    public async Task MarkPasswordResetTokenAsUsedAsync(string token, CancellationToken cancellationToken)
    {
        var resetToken = await dbContext.PasswordResetTokens
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
        
        if (resetToken != null)
        {
            resetToken.IsUsed = true;
            resetToken.UsedAt = DateTimeOffset.UtcNow;
            dbContext.PasswordResetTokens.Update(resetToken);
        }
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
