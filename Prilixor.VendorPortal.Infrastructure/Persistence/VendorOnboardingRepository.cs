using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.VendorPortal.Domain.Auth;
using Prilixor.VendorPortal.Domain.Support;
using Prilixor.Shared.Abstractions.DI;
using Microsoft.EntityFrameworkCore;

namespace Prilixor.VendorPortal.Infrastructure.Persistence;

public sealed class VendorOnboardingRepository(
    ApplicationDbContext dbContext,
    AdminPortalDbContext adminDbContext,
    CommonPortalDbContext commonDbContext)
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

    public Task<Vendor?> GetVendorByPhoneAsync(string phoneNumber, CancellationToken cancellationToken)
    {
        var normalized = new string(phoneNumber.Where(char.IsDigit).ToArray());
        return dbContext.Vendors
            .FirstOrDefaultAsync(x => x.SupportPhone == normalized && !x.IsDeleted, cancellationToken);
    }

    public Task<Vendor?> GetVendorByEmailVerificationTokenAsync(string token, CancellationToken cancellationToken)
    {
        var normalized = token.Trim();
        return dbContext.Vendors
            .FirstOrDefaultAsync(x => x.EmailVerificationToken == normalized && !x.IsDeleted, cancellationToken);
    }

    public Task<List<Vendor>> GetVendorsAsync(CancellationToken cancellationToken)
    {
        return dbContext.Vendors
            .Include(x => x.Documents)
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

    public async Task<ProductCategory?> GetProductCategoryByIdAsync(Guid categoryId, CancellationToken cancellationToken)
    {
        var category = await commonDbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);

        if (category is not null)
        {
            return category;
        }

        return await dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddProductCategoryAsync(ProductCategory category, CancellationToken cancellationToken)
    {
        await commonDbContext.ProductCategories.AddAsync(category, cancellationToken);

        var legacyCategory = await dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == category.Id, cancellationToken);
        if (legacyCategory is null)
        {
            await dbContext.ProductCategories.AddAsync(CloneCategory(category), cancellationToken);
            return;
        }

        CopyCategoryValues(category, legacyCategory);
        dbContext.ProductCategories.Update(legacyCategory);
    }

    public async Task UpdateProductCategoryAsync(ProductCategory category, CancellationToken cancellationToken)
    {
        commonDbContext.ProductCategories.Update(category);

        var legacyCategory = await dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == category.Id, cancellationToken);
        if (legacyCategory is null)
        {
            await dbContext.ProductCategories.AddAsync(CloneCategory(category), cancellationToken);
            return;
        }

        CopyCategoryValues(category, legacyCategory);
        dbContext.ProductCategories.Update(legacyCategory);
    }

    public async Task DeleteProductCategoryAsync(Guid categoryId, CancellationToken cancellationToken)
    {
        var category = await commonDbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);

        if (category is not null)
        {
            category.IsDeleted = true;
            category.DeletedAt = DateTimeOffset.UtcNow;
            commonDbContext.ProductCategories.Update(category);
        }

        var legacyCategory = await dbContext.ProductCategories
            .FirstOrDefaultAsync(x => x.Id == categoryId && !x.IsDeleted, cancellationToken);
        if (legacyCategory is not null)
        {
            legacyCategory.IsDeleted = true;
            legacyCategory.DeletedAt = DateTimeOffset.UtcNow;
            dbContext.ProductCategories.Update(legacyCategory);
        }
    }

    public async Task<List<ProductCategory>> GetProductCategoriesAsync(CancellationToken cancellationToken, bool includeDeleted = false)
    {
        var commonQuery = commonDbContext.ProductCategories.AsQueryable();
        if (!includeDeleted)
        {
            commonQuery = commonQuery.Where(x => !x.IsDeleted);
        }
        var categories = await commonQuery
            .OrderBy(x => x.CategoryName)
            .ToListAsync(cancellationToken);

        if (categories.Count > 0)
        {
            return categories;
        }

        var query = dbContext.ProductCategories.AsQueryable();
        if (!includeDeleted)
        {
            query = query.Where(x => !x.IsDeleted);
        }
        return await query
            .OrderBy(x => x.CategoryName)
            .ToListAsync(cancellationToken);
    }

    public async Task<Product?> GetProductByIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await commonDbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.ProductImages)
            .Include(x => x.Variants)
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);
        if (product is not null)
        {
            return product;
        }

        return await dbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.ProductImages)
            .Include(x => x.Variants)
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddProductAsync(Product product, CancellationToken cancellationToken)
    {
        await commonDbContext.Products.AddAsync(product, cancellationToken);

        var legacyProduct = await dbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.Variants)
            .FirstOrDefaultAsync(x => x.Id == product.Id, cancellationToken);
        if (legacyProduct is null)
        {
            await dbContext.Products.AddAsync(CloneProduct(product), cancellationToken);
            return;
        }

        CopyProductValues(product, legacyProduct);
        dbContext.Products.Update(legacyProduct);
    }

    public async Task UpdateProductAsync(Product product, CancellationToken cancellationToken)
    {
        commonDbContext.Products.Update(product);

        // Must include ChemicalProperty/Variants so CopyProductValues updates existing rows
        // instead of inserting duplicates (uq_chemical_properties_product / sku uniqueness).
        var legacyProduct = await dbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.Variants)
            .FirstOrDefaultAsync(x => x.Id == product.Id, cancellationToken);
        if (legacyProduct is null)
        {
            await dbContext.Products.AddAsync(CloneProduct(product), cancellationToken);
            return;
        }

        CopyProductValues(product, legacyProduct);
        dbContext.Products.Update(legacyProduct);
    }

    public async Task DeleteProductAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await commonDbContext.Products
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);

        if (product is not null)
        {
            product.IsDeleted = true;
            product.DeletedAt = DateTimeOffset.UtcNow;
            commonDbContext.Products.Update(product);
        }

        var legacyProduct = await dbContext.Products
            .FirstOrDefaultAsync(x => x.Id == productId && !x.IsDeleted, cancellationToken);
        if (legacyProduct is not null)
        {
            legacyProduct.IsDeleted = true;
            legacyProduct.DeletedAt = DateTimeOffset.UtcNow;
            dbContext.Products.Update(legacyProduct);
        }
    }

    public async Task<List<Product>> GetProductsAsync(Guid? categoryId, CancellationToken cancellationToken)
    {
        var query = commonDbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.ProductImages)
            .Include(x => x.Variants)
            .Where(x => !x.IsDeleted)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(x => x.CategoryId == categoryId.Value);
        }

        var products = await query.OrderBy(x => x.ProductName).ToListAsync(cancellationToken);
        if (products.Count > 0)
        {
            return products;
        }

        var legacyQuery = dbContext.Products
            .Include(x => x.ChemicalProperty)
            .Include(x => x.ProductImages)
            .Include(x => x.Variants)
            .Where(x => !x.IsDeleted)
            .AsQueryable();
        if (categoryId.HasValue)
        {
            legacyQuery = legacyQuery.Where(x => x.CategoryId == categoryId.Value);
        }

        return await legacyQuery.OrderBy(x => x.ProductName).ToListAsync(cancellationToken);
    }

    public async Task AddProductImageAsync(ProductImage image, CancellationToken cancellationToken)
    {
        await commonDbContext.ProductImages.AddAsync(image, cancellationToken);
    }

    public Task<ProductImage?> GetProductImageByIdAsync(Guid productId, Guid imageId, CancellationToken cancellationToken)
    {
        return commonDbContext.ProductImages
            .FirstOrDefaultAsync(x => x.Id == imageId && x.ProductId == productId && !x.IsDeleted, cancellationToken);
    }

    public Task UpdateProductImageAsync(ProductImage image, CancellationToken cancellationToken)
    {
        commonDbContext.ProductImages.Update(image);
        return Task.CompletedTask;
    }

    public Task<List<ProductImage>> GetProductImagesAsync(Guid productId, CancellationToken cancellationToken)
    {
        return commonDbContext.ProductImages
            .Where(x => x.ProductId == productId && !x.IsDeleted)
            .OrderByDescending(x => x.IsPrimary)
            .ThenBy(x => x.DisplayOrder)
            .ToListAsync(cancellationToken);
    }

    public Task<VendorProductListing?> GetVendorProductListingByIdAsync(Guid vendorId, Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .FirstOrDefaultAsync(x => x.Id == listingId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public Task<VendorProductListing?> GetVendorProductListingByVendorProductAsync(Guid vendorId, Guid productId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && x.ProductId == productId, cancellationToken);
    }

    public async Task AddVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken)
    {
        await dbContext.VendorProductListings.AddAsync(listing, cancellationToken);
    }

    public Task UpdateVendorProductListingAsync(VendorProductListing listing, CancellationToken cancellationToken)
    {
        var entry = dbContext.Entry(listing);
        if (entry.State == EntityState.Detached)
        {
            dbContext.VendorProductListings.Update(listing);
        }
        // Already tracked: property mutations are enough — Update() would mark the whole graph Modified.
        return Task.CompletedTask;
    }

    public async Task DeleteVendorProductListingAsync(Guid vendorId, Guid listingId, CancellationToken cancellationToken)
    {
        var listing = await dbContext.VendorProductListings
            .FirstOrDefaultAsync(x => x.Id == listingId && x.VendorId == vendorId && !x.IsDeleted, cancellationToken);

        if (listing is not null)
        {
            listing.IsDeleted = true;
            listing.DeletedAt = DateTimeOffset.UtcNow;
            listing.DeletedBy = vendorId;
            dbContext.VendorProductListings.Update(listing);
        }
    }

    public Task<List<VendorProductListing>> GetVendorProductListingsAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductListings
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<HashSet<Guid>> GetChemicalProductIdsAsync(List<Guid> productIds, CancellationToken cancellationToken)
    {
        if (productIds.Count == 0) return [];

        // Prefer common portal catalog (source of truth), then vendor DB, then chemical categories.
        var fromCommonCp = await commonDbContext.ChemicalProperties
            .Where(cp => productIds.Contains(cp.ProductId))
            .Select(cp => cp.ProductId)
            .ToListAsync(cancellationToken);

        var fromVendorCp = await dbContext.ChemicalProperties
            .Where(cp => productIds.Contains(cp.ProductId))
            .Select(cp => cp.ProductId)
            .ToListAsync(cancellationToken);

        var fromChemicalCategories = await commonDbContext.Products
            .Where(p => productIds.Contains(p.Id) && !p.IsDeleted)
            .Join(
                commonDbContext.ProductCategories.Where(c => c.IsChemical && !c.IsDeleted),
                p => p.CategoryId,
                c => c.Id,
                (p, _) => p.Id)
            .ToListAsync(cancellationToken);

        if (fromChemicalCategories.Count == 0)
        {
            fromChemicalCategories = await dbContext.Products
                .Where(p => productIds.Contains(p.Id) && !p.IsDeleted)
                .Join(
                    dbContext.ProductCategories.Where(c => c.IsChemical && !c.IsDeleted),
                    p => p.CategoryId,
                    c => c.Id,
                    (p, _) => p.Id)
                .ToListAsync(cancellationToken);
        }

        return [.. fromCommonCp.Concat(fromVendorCp).Concat(fromChemicalCategories)];
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
        var entry = dbContext.Entry(inventory);
        if (entry.State != EntityState.Detached)
        {
            // Already tracked (loaded earlier): caller mutated quantities — do not call Update().
            return;
        }

        // Pre-assigned Ids are common (Guid.CreateVersion7). Never Update() a row that is not in the DB yet.
        var exists = inventory.Id != Guid.Empty && await dbContext.VendorInventory
            .AsNoTracking()
            .AnyAsync(x => x.Id == inventory.Id, cancellationToken);

        if (!exists && inventory.Id != Guid.Empty)
        {
            exists = await dbContext.VendorInventory
                .AsNoTracking()
                .AnyAsync(x => x.VendorProductListingId == inventory.VendorProductListingId && !x.IsDeleted, cancellationToken);
        }

        if (exists)
        {
            var tracked = await dbContext.VendorInventory
                .FirstOrDefaultAsync(x =>
                    x.Id == inventory.Id ||
                    (x.VendorProductListingId == inventory.VendorProductListingId && !x.IsDeleted),
                    cancellationToken);
            if (tracked is not null)
            {
                tracked.TotalQuantity = inventory.TotalQuantity;
                tracked.AvailableQuantity = inventory.AvailableQuantity;
                tracked.ReservedQuantity = inventory.ReservedQuantity;
                tracked.RentedQuantity = inventory.RentedQuantity;
                tracked.BlockedQuantity = inventory.BlockedQuantity;
                return;
            }
        }

        if (inventory.Id == Guid.Empty)
        {
            inventory.Id = Guid.CreateVersion7();
        }

        await dbContext.VendorInventory.AddAsync(inventory, cancellationToken);
    }

    public Task<List<VendorVariantInventory>> GetVariantInventoryByListingIdAsync(Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorVariantInventories
            .Include(x => x.ProductVariant)
            .Where(x => x.VendorProductListingId == listingId)
            .OrderBy(x => x.ProductVariant.SizeValue)
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertVariantInventoryAsync(VendorVariantInventory item, CancellationToken cancellationToken)
    {
        var entry = dbContext.Entry(item);
        if (entry.State != EntityState.Detached)
        {
            // Included ProductVariant must stay Unchanged — never cascade an UPDATE to catalog rows.
            var variantEntry = entry.Reference(x => x.ProductVariant).TargetEntry;
            if (variantEntry is { State: EntityState.Modified or EntityState.Added })
            {
                variantEntry.State = EntityState.Unchanged;
            }

            return;
        }

        // Detached graphs: strip navigations so Update/Add cannot mark ProductVariant Modified.
        item.ProductVariant = null!;
        item.VendorProductListing = null!;

        // New instances often already have an Id (CreateVersion7). Calling Update() would
        // emit UPDATE … WHERE id = @id and hit DbUpdateConcurrencyException (0 rows).
        var existing = await dbContext.VendorVariantInventories
            .FirstOrDefaultAsync(
                x => x.VendorProductListingId == item.VendorProductListingId
                     && x.ProductVariantId == item.ProductVariantId,
                cancellationToken);

        if (existing is not null)
        {
            existing.TotalQuantity = item.TotalQuantity;
            existing.AvailableQuantity = item.AvailableQuantity;
            existing.ReservedQuantity = item.ReservedQuantity;
            return;
        }

        if (item.Id == Guid.Empty)
        {
            item.Id = Guid.CreateVersion7();
        }

        await dbContext.VendorVariantInventories.AddAsync(item, cancellationToken);
    }

    public void DiscardTrackedProductVariantChanges()
    {
        foreach (var entry in dbContext.ChangeTracker.Entries<ProductVariant>())
        {
            if (entry.State is EntityState.Modified or EntityState.Deleted)
            {
                entry.State = EntityState.Unchanged;
            }
        }
    }


    public async Task AddVendorProductAssetAsync(VendorProductAsset asset, CancellationToken cancellationToken)
    {
        await dbContext.VendorProductAssets.AddAsync(asset, cancellationToken);
    }

    public Task<VendorProductAsset?> GetVendorProductAssetByIdAsync(Guid assetId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductAssets
            .FirstOrDefaultAsync(x => x.Id == assetId && !x.IsDeleted, cancellationToken);
    }

    public Task<VendorProductAsset?> GetVendorProductAssetByTagAsync(Guid listingId, string assetTag, CancellationToken cancellationToken)
    {
        var normalized = assetTag.Trim().ToLowerInvariant();
        return dbContext.VendorProductAssets
            .FirstOrDefaultAsync(x => x.VendorProductListingId == listingId && x.AssetTag.ToLower() == normalized && !x.IsDeleted, cancellationToken);
    }

    public Task<VendorProductAsset?> GetVendorProductAssetByTagGlobalAsync(Guid vendorId, string assetTag, CancellationToken cancellationToken)
    {
        var normalized = assetTag.Trim().ToLowerInvariant();
        return dbContext.VendorProductAssets
            .Include(x => x.VendorProductListing)
            .FirstOrDefaultAsync(x => x.CreatedBy == vendorId && x.AssetTag.ToLower() == normalized && !x.IsDeleted, cancellationToken);
    }

    public Task<List<VendorProductAsset>> GetVendorProductAssetsAsync(Guid listingId, CancellationToken cancellationToken)
    {
        return dbContext.VendorProductAssets
            .Include(x => x.ProductVariant)
            .Where(x => x.VendorProductListingId == listingId && !x.IsDeleted)
            .OrderBy(x => x.AssetTag)
            .ToListAsync(cancellationToken);
    }

    public Task UpdateVendorProductAssetAsync(VendorProductAsset asset, CancellationToken cancellationToken)
    {
        dbContext.VendorProductAssets.Update(asset);
        return Task.CompletedTask;
    }

    public async Task AddVendorInventoryMovementAsync(VendorInventoryMovement movement, CancellationToken cancellationToken)
    {
        await dbContext.VendorInventoryMovements.AddAsync(movement, cancellationToken);
    }

    public Task<List<VendorInventoryMovement>> GetVendorInventoryMovementsAsync(Guid inventoryId, CancellationToken cancellationToken)
    {
        return dbContext.VendorInventoryMovements
            .Where(x => x.VendorInventoryId == inventoryId && !x.IsDeleted)
            .OrderByDescending(x => x.EventAt)
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
            .OrderByDescending(x => x.SentAt)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<int> GetUnreadNotificationCountAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorNotifications
            .CountAsync(x => x.VendorId == vendorId && !x.IsDeleted && x.ReadAt == null, cancellationToken);
    }

    public Task<VendorPushSubscription?> GetVendorPushSubscriptionAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.VendorPushSubscriptions
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && !x.IsDeleted, cancellationToken);
    }

    public async Task UpsertVendorPushSubscriptionAsync(VendorPushSubscription subscription, CancellationToken cancellationToken)
    {
        var existing = await dbContext.VendorPushSubscriptions
            .FirstOrDefaultAsync(x => x.VendorId == subscription.VendorId && !x.IsDeleted, cancellationToken);

        if (existing != null)
        {
            existing.Endpoint = subscription.Endpoint;
            existing.P256DH = subscription.P256DH;
            existing.Auth = subscription.Auth;
            dbContext.VendorPushSubscriptions.Update(existing);
        }
        else
        {
            await dbContext.VendorPushSubscriptions.AddAsync(subscription, cancellationToken);
        }
    }

    public async Task DeleteVendorPushSubscriptionAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        var subscription = await dbContext.VendorPushSubscriptions
            .FirstOrDefaultAsync(x => x.VendorId == vendorId && !x.IsDeleted, cancellationToken);

        if (subscription != null)
        {
            subscription.IsDeleted = true;
            subscription.DeletedAt = DateTimeOffset.UtcNow;
            dbContext.VendorPushSubscriptions.Update(subscription);
        }
    }

    public Task<AdminUser?> GetAdminUserByIdAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        return adminDbContext.AdminUsers
            .Include(x => x.AdminRole)
            .FirstOrDefaultAsync(x => x.Id == adminUserId && !x.IsDeleted, cancellationToken);
    }

    public Task<AdminUser?> GetAdminUserByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return adminDbContext.AdminUsers
            .Include(x => x.AdminRole)
            .FirstOrDefaultAsync(x => x.Email == normalized && !x.IsDeleted, cancellationToken);
    }

    public async Task AddAdminUserAsync(AdminUser adminUser, CancellationToken cancellationToken)
    {
        await adminDbContext.AdminUsers.AddAsync(adminUser, cancellationToken);
    }

    public Task UpdateAdminUserAsync(AdminUser adminUser, CancellationToken cancellationToken)
    {
        adminDbContext.AdminUsers.Update(adminUser);
        return Task.CompletedTask;
    }

    public Task<List<AdminUser>> GetAdminUsersAsync(CancellationToken cancellationToken)
    {
        return adminDbContext.AdminUsers
            .Include(x => x.AdminRole)
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountActiveSuperAdminsAsync(CancellationToken cancellationToken)
    {
        return adminDbContext.AdminUsers
            .CountAsync(x => !x.IsDeleted
                && x.IsActive
                && x.Role == SuperAdminRules.RoleCode, cancellationToken);
    }

    public async Task<List<string>> GetAdminPermissionCodesAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        var admin = await adminDbContext.AdminUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == adminUserId && !x.IsDeleted, cancellationToken);
        if (admin is null) return [];

        if (admin.RoleId is Guid roleId)
        {
            return await GetPermissionCodesForRoleAsync(roleId, cancellationToken);
        }

        // Legacy fallback: map string role via seeded system matrix
        if (AdminPermissions.SystemRolePermissions.TryGetValue(admin.Role, out var codes))
            return codes.ToList();
        return [];
    }

    public async Task<string?> GetAdminRoleCodeAsync(Guid adminUserId, CancellationToken cancellationToken)
    {
        var admin = await adminDbContext.AdminUsers
            .AsNoTracking()
            .Include(x => x.AdminRole)
            .FirstOrDefaultAsync(x => x.Id == adminUserId && !x.IsDeleted, cancellationToken);
        if (admin is null) return null;
        return admin.AdminRole?.Code ?? admin.Role;
    }

    public Task<List<AdminRole>> GetAdminRolesAsync(CancellationToken cancellationToken) =>
        adminDbContext.AdminRoles
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public Task<AdminRole?> GetAdminRoleByIdAsync(Guid roleId, CancellationToken cancellationToken) =>
        adminDbContext.AdminRoles
            .Include(x => x.RolePermissions)
            .FirstOrDefaultAsync(x => x.Id == roleId && !x.IsDeleted, cancellationToken);

    public Task<AdminRole?> GetAdminRoleByCodeAsync(string code, CancellationToken cancellationToken)
    {
        var normalized = code.Trim().ToLowerInvariant();
        return adminDbContext.AdminRoles
            .FirstOrDefaultAsync(x => x.Code == normalized && !x.IsDeleted, cancellationToken);
    }

    public async Task AddAdminRoleAsync(AdminRole role, CancellationToken cancellationToken) =>
        await adminDbContext.AdminRoles.AddAsync(role, cancellationToken);

    public Task UpdateAdminRoleAsync(AdminRole role, CancellationToken cancellationToken)
    {
        adminDbContext.AdminRoles.Update(role);
        return Task.CompletedTask;
    }

    public Task<List<AdminPermission>> GetAdminPermissionsAsync(CancellationToken cancellationToken) =>
        adminDbContext.AdminPermissions
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

    public async Task SetAdminRolePermissionsAsync(Guid roleId, IReadOnlyList<Guid> permissionIds, CancellationToken cancellationToken)
    {
        var existing = await adminDbContext.AdminRolePermissions
            .Where(x => x.RoleId == roleId)
            .ToListAsync(cancellationToken);
        adminDbContext.AdminRolePermissions.RemoveRange(existing);
        foreach (var pid in permissionIds.Distinct())
        {
            await adminDbContext.AdminRolePermissions.AddAsync(new AdminRolePermission
            {
                RoleId = roleId,
                PermissionId = pid
            }, cancellationToken);
        }
    }

    public Task<List<string>> GetPermissionCodesForRoleAsync(Guid roleId, CancellationToken cancellationToken) =>
        adminDbContext.AdminRolePermissions
            .AsNoTracking()
            .Where(x => x.RoleId == roleId)
            .Join(adminDbContext.AdminPermissions, rp => rp.PermissionId, p => p.Id, (_, p) => p.Code)
            .ToListAsync(cancellationToken);

    public async Task AddImpersonationExchangeAsync(AdminImpersonationExchange exchange, CancellationToken cancellationToken) =>
        await adminDbContext.AdminImpersonationExchanges.AddAsync(exchange, cancellationToken);

    public Task<AdminImpersonationExchange?> GetImpersonationExchangeByCodeHashAsync(string codeHash, CancellationToken cancellationToken) =>
        adminDbContext.AdminImpersonationExchanges
            .FirstOrDefaultAsync(x => x.CodeHash == codeHash, cancellationToken);

    public Task UpdateImpersonationExchangeAsync(AdminImpersonationExchange exchange, CancellationToken cancellationToken)
    {
        adminDbContext.AdminImpersonationExchanges.Update(exchange);
        return Task.CompletedTask;
    }

    public async Task AddAdminAuditLogAsync(AdminAuditLog auditLog, CancellationToken cancellationToken)
    {
        await adminDbContext.AdminAuditLogs.AddAsync(auditLog, cancellationToken);
    }

    public Task<List<AdminAuditLog>> GetAdminAuditLogsAsync(Guid? adminId, CancellationToken cancellationToken)
    {
        var query = adminDbContext.AdminAuditLogs
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
        return adminDbContext.PasswordResetTokens
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
    }

    public async Task AddPasswordResetTokenAsync(PasswordResetToken token, CancellationToken cancellationToken)
    {
        await adminDbContext.PasswordResetTokens.AddAsync(token, cancellationToken);
    }

    public async Task MarkPasswordResetTokenAsUsedAsync(string token, CancellationToken cancellationToken)
    {
        var resetToken = await adminDbContext.PasswordResetTokens
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
        
        if (resetToken != null)
        {
            resetToken.IsUsed = true;
            resetToken.UsedAt = DateTimeOffset.UtcNow;
            adminDbContext.PasswordResetTokens.Update(resetToken);
        }
    }

    public Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken)
    {
        return adminDbContext.RefreshTokens
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
    }

    public async Task AddRefreshTokenAsync(RefreshToken token, CancellationToken cancellationToken)
    {
        await adminDbContext.RefreshTokens.AddAsync(token, cancellationToken);
    }

    public Task UpdateRefreshTokenAsync(RefreshToken token, CancellationToken cancellationToken)
    {
        adminDbContext.RefreshTokens.Update(token);
        return Task.CompletedTask;
    }

    public async Task AddSupportTicketAsync(SupportTicket ticket, CancellationToken cancellationToken)
    {
        await dbContext.SupportTickets.AddAsync(ticket, cancellationToken);
    }

    public Task<SupportTicket?> GetSupportTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        return dbContext.SupportTickets
            .Include(x => x.Messages)
            .Include(x => x.Vendor)
            .FirstOrDefaultAsync(x => x.Id == ticketId && !x.IsDeleted, cancellationToken);
    }

    public Task<List<SupportTicket>> GetSupportTicketsByVendorIdAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        return dbContext.SupportTickets
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<List<SupportTicket>> GetSupportTicketsAsync(CancellationToken cancellationToken)
    {
        return dbContext.SupportTickets
            .Include(x => x.Vendor)
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task UpdateSupportTicketAsync(SupportTicket ticket, CancellationToken cancellationToken)
    {
        dbContext.SupportTickets.Update(ticket);
        await Task.CompletedTask;
    }

    public async Task AddSupportMessageAsync(SupportMessage message, CancellationToken cancellationToken)
    {
        await dbContext.SupportMessages.AddAsync(message, cancellationToken);
    }

    public Task<List<SupportMessage>> GetSupportMessagesByTicketIdAsync(Guid ticketId, CancellationToken cancellationToken)
    {
        return dbContext.SupportMessages
            .Where(x => x.TicketId == ticketId && !x.IsDeleted)
            .OrderBy(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        var primaryChanges = await dbContext.SaveChangesAsync(cancellationToken);
        var adminChanges = await adminDbContext.SaveChangesAsync(cancellationToken);
        var commonChanges = await commonDbContext.SaveChangesAsync(cancellationToken);
        return primaryChanges + adminChanges + commonChanges;
    }

    private static ProductCategory CloneCategory(ProductCategory source) =>
        new()
        {
            Id = source.Id,
            CategoryName = source.CategoryName,
            PrescriptionRequired = source.PrescriptionRequired,
            DepositRequired = source.DepositRequired,
            InstallationRequired = source.InstallationRequired,
            IsChemical = source.IsChemical,
            IsActive = source.IsActive,
            CreatedOnUtc = source.CreatedOnUtc,
            ModifiedOnUtc = source.ModifiedOnUtc,
            IsDeleted = source.IsDeleted,
            DeletedAt = source.DeletedAt,
            DeletedBy = source.DeletedBy,
        };

    private static void CopyCategoryValues(ProductCategory source, ProductCategory destination)
    {
        destination.CategoryName = source.CategoryName;
        destination.PrescriptionRequired = source.PrescriptionRequired;
        destination.DepositRequired = source.DepositRequired;
        destination.InstallationRequired = source.InstallationRequired;
        destination.IsChemical = source.IsChemical;
        destination.IsActive = source.IsActive;
        destination.CreatedOnUtc = source.CreatedOnUtc;
        destination.ModifiedOnUtc = source.ModifiedOnUtc;
        destination.IsDeleted = source.IsDeleted;
        destination.DeletedAt = source.DeletedAt;
        destination.DeletedBy = source.DeletedBy;
    }

    private static Product CloneProduct(Product source) =>
        new()
        {
            Id = source.Id,
            CategoryId = source.CategoryId,
            ProductName = source.ProductName,
            BrandName = source.BrandName,
            ModelName = source.ModelName,
            ShortDescription = source.ShortDescription,
            LongDescription = source.LongDescription,
            DailyRent = source.DailyRent,
            MonthlyRent = source.MonthlyRent,
            SecurityDeposit = source.SecurityDeposit,
            BuyPrice = source.BuyPrice,
            VendorDailyRent = source.VendorDailyRent,
            VendorMonthlyRent = source.VendorMonthlyRent,
            VendorSecurityDeposit = source.VendorSecurityDeposit,
            VendorBuyPrice = source.VendorBuyPrice,
            GstPercent = source.GstPercent,
            IsRentEnabled = source.IsRentEnabled,
            IsBuyEnabled = source.IsBuyEnabled,
            IsActive = source.IsActive,
            CreatedOnUtc = source.CreatedOnUtc,
            ModifiedOnUtc = source.ModifiedOnUtc,
            IsDeleted = source.IsDeleted,
            DeletedAt = source.DeletedAt,
            DeletedBy = source.DeletedBy,
            ChemicalProperty = source.ChemicalProperty == null ? null : new ChemicalProperty
            {
                Id = source.ChemicalProperty.Id == Guid.Empty ? Guid.NewGuid() : source.ChemicalProperty.Id,
                ProductId = source.Id,
                CasNumber = source.ChemicalProperty.CasNumber,
                ChemicalFormula = source.ChemicalProperty.ChemicalFormula,
                PurityPercentage = source.ChemicalProperty.PurityPercentage,
                MolecularWeight = source.ChemicalProperty.MolecularWeight,
                BaseUnit = source.ChemicalProperty.BaseUnit,
                SdsDocumentUrl = source.ChemicalProperty.SdsDocumentUrl,
                CoaDocumentUrl = source.ChemicalProperty.CoaDocumentUrl,
            },
            Variants = source.Variants?.Select(v => new ProductVariant
            {
                Id = v.Id,
                ProductId = v.ProductId,
                Sku = v.Sku,
                SizeValue = v.SizeValue,
                SizeUnit = v.SizeUnit,
                VendorPrice = v.VendorPrice,
                BuyPrice = v.BuyPrice,
                IsActive = v.IsActive,
                CreatedOnUtc = v.CreatedOnUtc,
                ModifiedOnUtc = v.ModifiedOnUtc
            }).ToList() ?? []
        };

    private static void CopyProductValues(Product source, Product destination)
    {
        destination.CategoryId = source.CategoryId;
        destination.ProductName = source.ProductName;
        destination.BrandName = source.BrandName;
        destination.ModelName = source.ModelName;
        destination.ShortDescription = source.ShortDescription;
        destination.LongDescription = source.LongDescription;
        destination.DailyRent = source.DailyRent;
        destination.MonthlyRent = source.MonthlyRent;
        destination.SecurityDeposit = source.SecurityDeposit;
        destination.BuyPrice = source.BuyPrice;
        destination.VendorDailyRent = source.VendorDailyRent;
        destination.VendorMonthlyRent = source.VendorMonthlyRent;
        destination.VendorSecurityDeposit = source.VendorSecurityDeposit;
        destination.VendorBuyPrice = source.VendorBuyPrice;
        destination.GstPercent = source.GstPercent;
        destination.IsRentEnabled = source.IsRentEnabled;
        destination.IsBuyEnabled = source.IsBuyEnabled;
        destination.IsActive = source.IsActive;
        destination.CreatedOnUtc = source.CreatedOnUtc;
        destination.ModifiedOnUtc = source.ModifiedOnUtc;
        destination.IsDeleted = source.IsDeleted;
        destination.DeletedAt = source.DeletedAt;
        destination.DeletedBy = source.DeletedBy;

        if (source.ChemicalProperty != null)
        {
            if (destination.ChemicalProperty is null)
            {
                destination.ChemicalProperty = new ChemicalProperty
                {
                    Id = source.ChemicalProperty.Id == Guid.Empty ? Guid.NewGuid() : source.ChemicalProperty.Id,
                    ProductId = destination.Id
                };
            }

            destination.ChemicalProperty.CasNumber = source.ChemicalProperty.CasNumber;
            destination.ChemicalProperty.ChemicalFormula = source.ChemicalProperty.ChemicalFormula;
            destination.ChemicalProperty.PurityPercentage = source.ChemicalProperty.PurityPercentage;
            destination.ChemicalProperty.MolecularWeight = source.ChemicalProperty.MolecularWeight;
            destination.ChemicalProperty.BaseUnit = source.ChemicalProperty.BaseUnit;
            destination.ChemicalProperty.SdsDocumentUrl = source.ChemicalProperty.SdsDocumentUrl;
            destination.ChemicalProperty.CoaDocumentUrl = source.ChemicalProperty.CoaDocumentUrl;
        }

        if (source.Variants != null)
        {
            destination.Variants ??= new List<ProductVariant>();
            foreach (var sv in source.Variants)
            {
                var dv = destination.Variants.FirstOrDefault(v => v.Id == sv.Id || (!string.IsNullOrEmpty(v.Sku) && v.Sku == sv.Sku));
                if (dv is null)
                {
                    destination.Variants.Add(new ProductVariant
                    {
                        Id = sv.Id == Guid.Empty ? Guid.NewGuid() : sv.Id,
                        ProductId = destination.Id,
                        Sku = sv.Sku,
                        SizeValue = sv.SizeValue,
                        SizeUnit = sv.SizeUnit,
                        VendorPrice = sv.VendorPrice,
                        BuyPrice = sv.BuyPrice,
                        IsActive = sv.IsActive,
                        CreatedOnUtc = sv.CreatedOnUtc,
                        ModifiedOnUtc = sv.ModifiedOnUtc
                    });
                }
                else
                {
                    dv.Sku = sv.Sku;
                    dv.SizeValue = sv.SizeValue;
                    dv.SizeUnit = sv.SizeUnit;
                    dv.VendorPrice = sv.VendorPrice;
                    dv.BuyPrice = sv.BuyPrice;
                    dv.IsActive = sv.IsActive;
                    dv.ModifiedOnUtc = sv.ModifiedOnUtc;
                }
            }
            var toRemove = destination.Variants
                .Where(dv => !source.Variants.Any(sv => sv.Id == dv.Id || (!string.IsNullOrEmpty(sv.Sku) && sv.Sku == dv.Sku)))
                .ToList();
            foreach (var tr in toRemove)
            {
                destination.Variants.Remove(tr);
            }
        }
    }
}
