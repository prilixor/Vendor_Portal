using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.DI;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;



namespace Prilixor.VendorPortal.Infrastructure.Persistence;



public sealed class CustomerRepository(
    ApplicationDbContext vendorDb,
    CustomerPortalDbContext customerDb,
    CommonPortalDbContext commonDb,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<RentalPricingOptions> rentalPricingOptions)
    : ICustomerRepository, IScopedService

{

    public Task<Customer?> GetCustomerByIdAsync(Guid customerId, CancellationToken cancellationToken) =>

        customerDb.Customers.FirstOrDefaultAsync(c => c.Id == customerId && !c.IsDeleted, cancellationToken);



    public Task<Customer?> GetCustomerByEmailAsync(string email, CancellationToken cancellationToken)

    {

        var normalized = email.Trim().ToLowerInvariant();

        return customerDb.Customers.FirstOrDefaultAsync(c => c.Email == normalized && !c.IsDeleted, cancellationToken);

    }



    public async Task AddCustomerAsync(Customer customer, CancellationToken cancellationToken) =>

        await customerDb.Customers.AddAsync(customer, cancellationToken);



    public Task UpdateCustomerAsync(Customer customer, CancellationToken cancellationToken)

    {

        customerDb.Customers.Update(customer);

        return Task.CompletedTask;

    }



    public Task<List<CustomerAddress>> GetCustomerAddressesAsync(Guid customerId, CancellationToken cancellationToken) =>

        customerDb.CustomerAddresses

            .Where(a => a.CustomerId == customerId && !a.IsDeleted)

            .OrderByDescending(a => a.IsDefault)

            .ThenByDescending(a => a.CreatedOnUtc)

            .ToListAsync(cancellationToken);



    public Task<CustomerAddress?> GetCustomerAddressByIdAsync(Guid customerId, Guid addressId, CancellationToken cancellationToken) =>

        customerDb.CustomerAddresses.FirstOrDefaultAsync(

            a => a.Id == addressId && a.CustomerId == customerId && !a.IsDeleted,

            cancellationToken);



    public async Task AddCustomerAddressAsync(CustomerAddress address, CancellationToken cancellationToken) =>

        await customerDb.CustomerAddresses.AddAsync(address, cancellationToken);



    public Task UpdateCustomerAddressAsync(CustomerAddress address, CancellationToken cancellationToken)

    {

        customerDb.CustomerAddresses.Update(address);

        return Task.CompletedTask;

    }



    public async Task<List<CustomerCatalogListingDto>> GetPublicCatalogListingsAsync(

        string? categoryFilter,

        string? search,
        Guid? customerId,

        CancellationToken cancellationToken)

    {

        var q = vendorDb.VendorProductListings

            .AsNoTracking()

            .Include(l => l.Vendor)

            .ThenInclude(v => v.Profile)

            .Include(l => l.Images)

            .Include(l => l.Inventory)

            .Where(l =>

                !l.IsDeleted &&

                (EF.Functions.ILike(l.ListingStatus, "active") ||

                 EF.Functions.ILike(l.ListingStatus, "approved")) &&

                !l.Vendor.IsDeleted &&

                EF.Functions.ILike(l.Vendor.AccountStatus, "active"));



        if (!string.IsNullOrWhiteSpace(search))

        {

            var s = search.Trim();

            q = q.Where(l =>

                EF.Functions.ILike(l.ListingTitle, $"%{s}%") ||

                (l.Vendor.Profile != null && EF.Functions.ILike(l.Vendor.Profile.BusinessName, $"%{s}%")));

        }



        var rows = await q

            .OrderByDescending(l => l.CreatedOnUtc)

            .Take(1000)

            .ToListAsync(cancellationToken);

        var productQuery = commonDb.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.ProductImages)
            .Include(p => p.ChemicalProperty)
            .Include(p => p.Variants)
            .Include(p => p.RentalPricingPlans)
            .Where(p =>
                !p.IsDeleted &&
                p.IsActive &&
                p.Category != null &&
                !p.Category.IsDeleted &&
                p.Category.IsActive);

        if (!string.IsNullOrWhiteSpace(categoryFilter))
        {
            var cf = categoryFilter.Trim();
            productQuery = productQuery.Where(p =>
                p.Category != null &&
                p.Category.CategoryName == cf);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            productQuery = productQuery.Where(p =>
                EF.Functions.ILike(p.ProductName, $"%{s}%") ||
                (p.BrandName != null && EF.Functions.ILike(p.BrandName, $"%{s}%")) ||
                (p.ModelName != null && EF.Functions.ILike(p.ModelName, $"%{s}%")) ||
                (p.Category != null && EF.Functions.ILike(p.Category.CategoryName, $"%{s}%")));
        }

        var products = await productQuery.ToListAsync(cancellationToken);

        var productMap = products.ToDictionary(p => p.Id);

        IEnumerable<VendorProductListing> filtered = rows;
        if (!string.IsNullOrWhiteSpace(categoryFilter))
        {
            var cf = categoryFilter.Trim();
            filtered = filtered.Where(r =>
            {
                var categoryName = productMap.GetValueOrDefault(r.ProductId)?.Category?.CategoryName;
                return !string.IsNullOrWhiteSpace(categoryName) &&
                       string.Equals(categoryName, cf, StringComparison.OrdinalIgnoreCase);
            });
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            filtered = filtered.Where(r =>
            {
                var productName = productMap.GetValueOrDefault(r.ProductId)?.ProductName ?? string.Empty;
                return productName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       r.ListingTitle.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       (r.Vendor.Profile?.BusinessName?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false);
            });
        }

        var filteredRows = filtered
            .Where(r => productMap.ContainsKey(r.ProductId))
            .OrderByDescending(r => r.CreatedOnUtc)
            .Take(500)
            .ToList();

        var variantAvailableSums = await GetVariantAvailableSumsAsync(
            filteredRows.Select(r => r.Id).Distinct().ToList(),
            cancellationToken);

        int Qty(VendorProductListing listing) =>
            ResolvePublicAvailableQuantity(
                listing,
                productMap.GetValueOrDefault(listing.ProductId),
                variantAvailableSums);

        CustomerAddress? sortingAddress = null;
        if (customerId.HasValue)
        {
            sortingAddress = await customerDb.CustomerAddresses
                .AsNoTracking()
                .Where(a =>
                    a.CustomerId == customerId.Value &&
                    !a.IsDeleted &&
                    a.Latitude.HasValue &&
                    a.Longitude.HasValue)
                .OrderByDescending(a => a.IsDefault)
                .ThenByDescending(a => a.CreatedOnUtc)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var productAvailability = filteredRows
            .GroupBy(r => r.ProductId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(Qty));

        var representativeRows = filteredRows
            .GroupBy(r => r.ProductId)
            .Select(g =>
            {
                IOrderedEnumerable<VendorProductListing> ordered;
                if (sortingAddress is not null)
                {
                    ordered = g
                        .OrderBy(r =>
                        {
                            if (r.Vendor?.Profile?.Latitude is not decimal vendorLat || r.Vendor.Profile?.Longitude is not decimal vendorLng)
                                return decimal.MaxValue;
                            return CalculateDistanceKm(
                                sortingAddress.Latitude!.Value,
                                sortingAddress.Longitude!.Value,
                                vendorLat,
                                vendorLng);
                        })
                        .ThenByDescending(Qty)
                        .ThenByDescending(r => r.CreatedOnUtc);
                }
                else
                {
                    ordered = g
                        .OrderByDescending(Qty)
                        .ThenByDescending(r => r.CreatedOnUtc);
                }

                return ordered.First();
            })
            .ToList();

        var listingDtos = representativeRows.Select(l =>

        {

            var cat = productMap.GetValueOrDefault(l.ProductId)?.Category;

            var vendorName = l.Vendor.Profile?.BusinessName;

            if (string.IsNullOrWhiteSpace(vendorName))

                vendorName = l.Vendor.Email;

            var area = l.Vendor.Profile?.City is { Length: > 0 } c ? $"{c} region" : "Service area on request";

            var productPrimaryUrl = ResolvePrimaryProductImageUrl(productMap.GetValueOrDefault(l.ProductId)?.ProductImages ?? []);
            var primaryUrl = ResolvePrimaryListingImageUrl(l.Images) ?? productPrimaryUrl;
            var availableQuantity = Qty(l);
            var productTotalAvailableQuantity = productAvailability.GetValueOrDefault(l.ProductId, availableQuantity);
            var availabilityStatus = CatalogListingAvailability.ToStatus(productTotalAvailableQuantity);

            var product = productMap.GetValueOrDefault(l.ProductId);
            var (buyPrice, maxBuyPrice) = ResolveCatalogBuyPrices(product);

            return new CustomerCatalogListingDto(

                l.Id,

                string.IsNullOrWhiteSpace(product?.ProductName) ? l.ListingTitle : product.ProductName,

                vendorName ?? "Vendor",

                4.8m,

                area,

                cat?.CategoryName ?? "General",

                product?.DailyRent ?? l.DailyRent,

                product?.WeeklyRent ?? l.WeeklyRent,

                product?.MonthlyRent ?? l.MonthlyRent,

                product?.SecurityDeposit ?? l.SecurityDeposit,

                cat?.PrescriptionRequired ?? false,
                cat?.DepositRequired ?? false,
                l.ListingStatus,
                availableQuantity,
                productTotalAvailableQuantity,
                availabilityStatus,
                primaryUrl,
                buyPrice,
                product?.IsRentEnabled ?? true,
                product?.IsBuyEnabled ?? false,
                product?.ChemicalProperty?.CasNumber,
                product?.ChemicalProperty?.ChemicalFormula,
                product?.ChemicalProperty?.PurityPercentage,
                product?.ChemicalProperty?.MolecularWeight,
                product?.ChemicalProperty?.BaseUnit,
                cat?.IsChemical ?? false,
                maxBuyPrice);

        }).ToList();

        var listingDistanceMap = new Dictionary<Guid, decimal>();
        if (sortingAddress is not null)
        {
            foreach (var row in filteredRows)
            {
                if (row.Vendor?.Profile?.Latitude is not decimal vendorLat ||
                    row.Vendor.Profile?.Longitude is not decimal vendorLng)
                {
                    continue;
                }

                listingDistanceMap[row.Id] = CalculateDistanceKm(
                    sortingAddress.Latitude!.Value,
                    sortingAddress.Longitude!.Value,
                    vendorLat,
                    vendorLng);
            }
        }

        var combined = listingDtos
            .OrderBy(x => x.CategoryName)
            .ThenBy(x => x.Title)
            .ToList();

        if (sortingAddress is not null)
        {
            combined = combined
                .OrderBy(x => x.AvailableQuantity > 0 ? 0 : 1)
                .ThenBy(x => listingDistanceMap.TryGetValue(x.Id, out var d) ? d : decimal.MaxValue)
                .ThenBy(x => x.CategoryName)
                .ThenBy(x => x.Title)
                .ToList();
        }

        return combined.Take(500).ToList();

    }

    public async Task<List<CustomerCatalogListingDto>> GetRelatedCatalogListingsAsync(
        Guid listingId,
        int limit,
        Guid? customerId,
        CancellationToken cancellationToken)
    {
        var fullCatalog = await GetPublicCatalogListingsAsync(null, null, customerId, cancellationToken);
        if (fullCatalog is null || fullCatalog.Count == 0)
            return [];

        var target = fullCatalog.FirstOrDefault(x => x.Id == listingId);
        if (target is null)
            return [];

        var targetCategory = target.CategoryName;
        var targetIsChemical = target.IsChemical;
        var maxLimit = Math.Clamp(limit, 1, 10);

        var sameTypeCandidates = fullCatalog
            .Where(x => x.Id != listingId &&
                        !string.Equals(x.Title, target.Title, StringComparison.OrdinalIgnoreCase) &&
                        x.IsChemical == targetIsChemical)
            .ToList();

        var related = sameTypeCandidates
            .Where(x => !string.IsNullOrWhiteSpace(x.CategoryName) &&
                        string.Equals(x.CategoryName, targetCategory, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(x => x.AvailableQuantity > 0 ? 1 : 0)
            .ThenBy(x => x.Title)
            .Take(maxLimit)
            .ToList();

        if (related.Count < maxLimit)
        {
            var sameCategoryIds = related.Select(x => x.Id).ToHashSet();
            var remainingSlots = maxLimit - related.Count;

            var fallbackSameTypeItems = sameTypeCandidates
                .Where(x => !sameCategoryIds.Contains(x.Id))
                .OrderByDescending(x => x.AvailableQuantity > 0 ? 1 : 0)
                .ThenBy(x => x.Title)
                .Take(remainingSlots);

            related.AddRange(fallbackSameTypeItems);
        }

        return related;
    }

    private static decimal CalculateDistanceKm(decimal lat1, decimal lon1, decimal lat2, decimal lon2)
    {
        const double earthRadiusKm = 6371d;
        static double ToRadians(decimal angle) => (double)angle * Math.PI / 180d;

        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a =
            Math.Sin(dLat / 2d) * Math.Sin(dLat / 2d) +
            Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
            Math.Sin(dLon / 2d) * Math.Sin(dLon / 2d);
        a = Math.Max(0d, Math.Min(1d, a));
        var c = 2d * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1d - a));
        return decimal.Round((decimal)(earthRadiusKm * c), 2, MidpointRounding.AwayFromZero);
    }



    public async Task<VendorProductListingAggregate?> GetListingForCustomerAsync(Guid listingId, CancellationToken cancellationToken)

    {

        var l = await vendorDb.VendorProductListings

            .Include(x => x.Vendor).ThenInclude(v => v.Profile)

            .Include(x => x.Images)

            .Include(x => x.Inventory)

            .FirstOrDefaultAsync(x => x.Id == listingId && !x.IsDeleted, cancellationToken);



        if (l is null) return null;



        var product = await commonDb.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.ProductImages)
            .Include(p => p.ProductDocuments)
            .Include(p => p.ChemicalProperty)
            .Include(p => p.Variants)
            .Include(p => p.RentalPricingPlans)
            .FirstOrDefaultAsync(p => p.Id == l.ProductId && !p.IsDeleted, cancellationToken);
        if (product is null)
        {
            return null;
        }

        // Load per-variant (SKU) stock for chemical listings
        var variantInventory = await vendorDb.VendorVariantInventories
            .AsNoTracking()
            .Where(vi => vi.VendorProductListingId == listingId)
            .ToListAsync(cancellationToken);

        var liveIcons = await GetLiveRentalDurationIconsAsync(cancellationToken);
        var durationMasters = await GetActiveRentalDurationMastersAsync(cancellationToken);
        var isChemical = product.Category?.IsChemical == true || product.ChemicalProperty != null;
        var (productTotal, marketplaceVariants) = await LoadMarketplaceAvailabilityAsync(
            l.ProductId,
            isChemical,
            cancellationToken);
        return ToAggregate(
            l,
            product,
            variantInventory,
            liveIcons,
            durationMasters,
            productTotal,
            marketplaceVariants);
    }

    public async Task<List<VendorProductListingAggregate>> GetCandidateListingsByProductIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await commonDb.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.ProductImages)
            .Include(p => p.ProductDocuments)
            .Include(p => p.ChemicalProperty)
            .Include(p => p.Variants)
            .Include(p => p.RentalPricingPlans)
            .FirstOrDefaultAsync(p => p.Id == productId && !p.IsDeleted, cancellationToken);
        if (product is null)
        {
            return [];
        }

        var listings = await vendorDb.VendorProductListings
            .AsNoTracking()
            .Include(x => x.Vendor).ThenInclude(v => v.Profile)
            .Include(x => x.Images)
            .Include(x => x.Inventory)
            .Where(x =>
                x.ProductId == productId &&
                !x.IsDeleted &&
                !x.Vendor.IsDeleted &&
                (EF.Functions.ILike(x.ListingStatus, "active") || EF.Functions.ILike(x.ListingStatus, "approved")) &&
                EF.Functions.ILike(x.Vendor.AccountStatus, "active"))
            .ToListAsync(cancellationToken);

        var liveIcons = await GetLiveRentalDurationIconsAsync(cancellationToken);
        var durationMasters = await GetActiveRentalDurationMastersAsync(cancellationToken);
        var listingIds = listings.Select(l => l.Id).ToList();
        var variantRows = listingIds.Count == 0
            ? new List<Prilixor.VendorPortal.Domain.Vendors.VendorVariantInventory>()
            : await vendorDb.VendorVariantInventories
                .AsNoTracking()
                .Where(vi => listingIds.Contains(vi.VendorProductListingId))
                .ToListAsync(cancellationToken);
        var variantByListing = variantRows
            .GroupBy(vi => vi.VendorProductListingId)
            .ToDictionary(g => g.Key, g => g.ToList());
        return listings.Select(l => ToAggregate(
            l,
            product,
            variantByListing.GetValueOrDefault(l.Id) ?? [],
            liveIcons,
            durationMasters)).ToList();
    }



    public async Task AddCustomerRentalOrderAsync(CustomerRentalOrder order, CancellationToken cancellationToken) =>

        await customerDb.CustomerRentalOrders.AddAsync(order, cancellationToken);



    public async Task<List<CustomerRentalOrderWithListing>> GetCustomerOrdersAsync(Guid customerId, CancellationToken cancellationToken)

    {

        var orders = await customerDb.CustomerRentalOrders

            .AsNoTracking()

            .Where(o => o.CustomerId == customerId && !o.IsDeleted)

            .OrderByDescending(o => o.CreatedOnUtc)

            .ToListAsync(cancellationToken);



        var map = await LoadListingsWithVendorAsync(orders.ConvertAll(o => o.VendorProductListingId), cancellationToken);
        var productMap = await LoadProductsWithImagesAsync(map.Values.Select(l => l.ProductId), cancellationToken);

        var results = orders.ConvertAll(o =>
        {
            var listing = map.GetValueOrDefault(o.VendorProductListingId);
            var img = ResolveOrderPrimaryImageUrl(listing, productMap);
            return new CustomerRentalOrderWithListing(o, listing, img);
        });
        var withMedical = await AttachMedicalReferencesAsync(results, cancellationToken);
        return await AttachVariantDescriptionsAsync(withMedical, cancellationToken);
    }



    public async Task<CustomerRentalOrderWithListing?> GetCustomerOrderAsync(Guid customerId, Guid orderId, CancellationToken cancellationToken)

    {

        var order = await customerDb.CustomerRentalOrders

            .FirstOrDefaultAsync(o => o.Id == orderId && o.CustomerId == customerId && !o.IsDeleted, cancellationToken);

        if (order is null) return null;



        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
        var productMap = listing is null
            ? null
            : await LoadProductsWithImagesAsync([listing.ProductId], cancellationToken);
        var img = ResolveOrderPrimaryImageUrl(listing, productMap);

        var withMedical = await AttachMedicalReferenceAsync(new CustomerRentalOrderWithListing(order, listing, img), cancellationToken);
        return await AttachVariantDescriptionAsync(withMedical, cancellationToken);
    }



    public async Task<CustomerRentalOrderWithListing?> GetCustomerOrderByNumberAsync(Guid customerId, string orderNumber, CancellationToken cancellationToken)

    {

        var n = orderNumber.Trim();

        var order = await customerDb.CustomerRentalOrders

            .FirstOrDefaultAsync(o => o.CustomerId == customerId && o.OrderNumber == n && !o.IsDeleted, cancellationToken);

        if (order is null) return null;



        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
        var productMap = listing is null
            ? null
            : await LoadProductsWithImagesAsync([listing.ProductId], cancellationToken);
        var img = ResolveOrderPrimaryImageUrl(listing, productMap);

        var withMedical = await AttachMedicalReferenceAsync(new CustomerRentalOrderWithListing(order, listing, img), cancellationToken);
        return await AttachVariantDescriptionAsync(withMedical, cancellationToken);
    }



    public async Task<List<CustomerRentalOrderWithListing>> GetVendorOrdersAsync(Guid vendorId, string? status, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var query = customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.CustomerAddress)
            .Where(o => !o.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLowerInvariant();
            query = query.Where(o => o.Status.ToLower() == normalized);
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedOnUtc)
            .Take(1000)
            .ToListAsync(cancellationToken);

        var pendingOffers = await customerDb.CustomerOrderVendorOffers
            .AsNoTracking()
            .Where(x =>
                x.VendorId == vendorId &&
                x.Status == "pending" &&
                !x.IsDeleted &&
                x.ExpiresAt > now)
            .OrderBy(x => x.OfferRank)
            .ToListAsync(cancellationToken);

        var pendingByOrder = pendingOffers
            .GroupBy(x => x.CustomerRentalOrderId)
            .ToDictionary(g => g.Key, g => g.First());

        var listingIds = orders
            .Select(o => o.VendorProductListingId)
            .Concat(pendingOffers.Select(x => x.VendorProductListingId))
            .Distinct()
            .ToList();

        var map = await LoadListingsWithVendorAsync(listingIds, cancellationToken);
        var productMap = await LoadProductsWithImagesAsync(map.Values.Select(l => l.ProductId), cancellationToken);
        var results = orders
            .Select(o =>
            {
                var isAwaiting = string.Equals(o.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase);
                if (isAwaiting)
                {
                    if (!pendingByOrder.TryGetValue(o.Id, out var pendingOffer))
                        return null;

                    var pendingListing = map.GetValueOrDefault(pendingOffer.VendorProductListingId) ?? map.GetValueOrDefault(o.VendorProductListingId);
                    var pendingImg = ResolveOrderPrimaryImageUrl(pendingListing, productMap);
                    return new CustomerRentalOrderWithListing(o, pendingListing, pendingImg);
                }

                var listing = map.GetValueOrDefault(o.VendorProductListingId);
                if (listing is null || listing.VendorId != vendorId)
                    return null;

                var img = ResolveOrderPrimaryImageUrl(listing, productMap);
                return new CustomerRentalOrderWithListing(o, listing, img);
            })
            .Where(x => x is not null)
            .Select(x => x!)
            .ToList();
            
        var withMedical = await AttachMedicalReferencesAsync(results, cancellationToken);
        return await AttachVariantDescriptionsAsync(withMedical, cancellationToken);
    }

    public async Task<CustomerRentalOrderWithListing?> GetVendorOrderAsync(Guid vendorId, Guid orderId, CancellationToken cancellationToken)
    {
        var order = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.CustomerAddress)
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, cancellationToken);

        if (order is null)
            return null;

        VendorProductListing? listing;
        if (string.Equals(order.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase))
        {
            var pendingOffer = await customerDb.CustomerOrderVendorOffers
                .AsNoTracking()
                .Where(x =>
                    x.CustomerRentalOrderId == order.Id &&
                    x.VendorId == vendorId &&
                    x.Status == "pending" &&
                    !x.IsDeleted &&
                    x.ExpiresAt > DateTimeOffset.UtcNow)
                .OrderBy(x => x.OfferRank)
                .FirstOrDefaultAsync(cancellationToken);

            if (pendingOffer is null)
                return null;

            listing = await LoadListingWithVendorAsync(pendingOffer.VendorProductListingId, cancellationToken)
                ?? await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
        }
        else
        {
            listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
            if (listing is null || listing.VendorId != vendorId)
                return null;
        }

        var productMap = listing is null
            ? null
            : await LoadProductsWithImagesAsync([listing.ProductId], cancellationToken);
        var img = ResolveOrderPrimaryImageUrl(listing, productMap);
        var withMedical = await AttachMedicalReferenceAsync(new CustomerRentalOrderWithListing(order, listing, img), cancellationToken);
        return await AttachVariantDescriptionAsync(withMedical, cancellationToken);
    }

    public Task<bool> OrderNumberExistsAsync(string orderNumber, CancellationToken cancellationToken) =>

        customerDb.CustomerRentalOrders.AnyAsync(o => o.OrderNumber == orderNumber, cancellationToken);

    public Task<CustomerRentalOrder?> GetCustomerOrderEntityByIdAsync(Guid orderId, CancellationToken cancellationToken) =>
        customerDb.CustomerRentalOrders
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, cancellationToken);

    public async Task<CustomerRentalOrderWithListing?> GetCustomerOrderByIdAsync(Guid orderId, CancellationToken cancellationToken)
    {
        var order = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, cancellationToken);
        if (order is null)
            return null;

        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
        var productMap = listing is null
            ? null
            : await LoadProductsWithImagesAsync([listing.ProductId], cancellationToken);
        var img = ResolveOrderPrimaryImageUrl(listing, productMap);
        var withMedical = await AttachMedicalReferenceAsync(new CustomerRentalOrderWithListing(order, listing, img), cancellationToken);
        return await AttachVariantDescriptionAsync(withMedical, cancellationToken);
    }

    public async Task<List<CustomerRentalOrderWithListing>> GetAllCustomerOrdersForAdminAsync(CancellationToken cancellationToken)
    {
        var orders = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o => !o.IsDeleted)
            .OrderByDescending(o => o.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        var listingIds = orders.ConvertAll(o => o.VendorProductListingId);
        var map = await LoadListingsWithVendorAsync(listingIds, cancellationToken);
        var productMap = await LoadProductsWithImagesAsync(map.Values.Select(l => l.ProductId), cancellationToken);

        var results = orders.ConvertAll(o =>
        {
            var listing = map.GetValueOrDefault(o.VendorProductListingId);
            var img = ResolveOrderPrimaryImageUrl(listing, productMap);
            return new CustomerRentalOrderWithListing(o, listing, img);
        });
        var withMedical = await AttachMedicalReferencesAsync(results, cancellationToken);
        return await AttachVariantDescriptionsAsync(withMedical, cancellationToken);
    }

    public async Task AddCustomerRentalOrderExtensionAsync(CustomerRentalOrderExtension extension, CancellationToken cancellationToken)
    {
        await customerDb.CustomerRentalOrderExtensions.AddAsync(extension, cancellationToken);
    }

    public Task<CustomerRentalOrderExtension?> GetCustomerRentalOrderExtensionByIdAsync(Guid extensionId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerRentalOrderExtensions
            .FirstOrDefaultAsync(e => e.Id == extensionId && !e.IsDeleted, cancellationToken);
    }

    public Task UpdateCustomerRentalOrderExtensionAsync(CustomerRentalOrderExtension extension, CancellationToken cancellationToken)
    {
        customerDb.CustomerRentalOrderExtensions.Update(extension);
        return Task.CompletedTask;
    }

    public async Task AddCustomerRentalOrderBuyoutAsync(CustomerRentalOrderBuyout buyout, CancellationToken cancellationToken)
    {
        await customerDb.CustomerRentalOrderBuyouts.AddAsync(buyout, cancellationToken);
    }

    public Task<CustomerRentalOrderBuyout?> GetCustomerRentalOrderBuyoutByIdAsync(Guid buyoutId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerRentalOrderBuyouts
            .FirstOrDefaultAsync(b => b.Id == buyoutId && !b.IsDeleted, cancellationToken);
    }

    public Task UpdateCustomerRentalOrderBuyoutAsync(CustomerRentalOrderBuyout buyout, CancellationToken cancellationToken)
    {
        customerDb.CustomerRentalOrderBuyouts.Update(buyout);
        return Task.CompletedTask;
    }

    public async Task AddCustomerRentalOrderAssetAsync(CustomerRentalOrderAsset asset, CancellationToken cancellationToken)
    {
        await customerDb.CustomerRentalOrderAssets.AddAsync(asset, cancellationToken);
    }

    public Task<List<CustomerRentalOrderAsset>> GetCustomerRentalOrderAssetsAsync(Guid customerOrderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerRentalOrderAssets
            .Where(x => x.CustomerRentalOrderId == customerOrderId)
            .ToListAsync(cancellationToken);
    }

    public async Task AddCustomerOrderImageAsync(CustomerOrderImage image, CancellationToken cancellationToken)
    {
        await customerDb.CustomerOrderImages.AddAsync(image, cancellationToken);
    }

    public Task<List<CustomerOrderImage>> GetCustomerOrderImagesAsync(Guid customerOrderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImages
            .Where(x => x.CustomerRentalOrderId == customerOrderId && !x.IsDeleted)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<CustomerOrderImage?> GetCustomerOrderImageByIdAsync(Guid customerOrderId, Guid imageId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImages
            .FirstOrDefaultAsync(
                x => x.Id == imageId && x.CustomerRentalOrderId == customerOrderId && !x.IsDeleted,
                cancellationToken);
    }

    public Task UpdateCustomerOrderImageAsync(CustomerOrderImage image, CancellationToken cancellationToken)
    {
        customerDb.CustomerOrderImages.Update(image);
        return Task.CompletedTask;
    }

    public Task<int> CountCustomerOrderImagesAsync(Guid customerOrderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImages
            .CountAsync(x => x.CustomerRentalOrderId == customerOrderId && !x.IsDeleted, cancellationToken);
    }

    public async Task AddCustomerOrderImageRequestAsync(CustomerOrderImageRequest request, CancellationToken cancellationToken)
    {
        await customerDb.CustomerOrderImageRequests.AddAsync(request, cancellationToken);
    }

    public Task<CustomerOrderImageRequest?> GetOpenCustomerOrderImageRequestAsync(Guid customerOrderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImageRequests
            .FirstOrDefaultAsync(
                x => x.CustomerRentalOrderId == customerOrderId
                     && !x.IsDeleted
                     && x.Status == CustomerOrderImageRequest.StatusOpen,
                cancellationToken);
    }

    public Task<CustomerOrderImageRequest?> GetCustomerOrderImageRequestByIdAsync(Guid requestId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImageRequests
            .FirstOrDefaultAsync(x => x.Id == requestId && !x.IsDeleted, cancellationToken);
    }

    public Task UpdateCustomerOrderImageRequestAsync(CustomerOrderImageRequest request, CancellationToken cancellationToken)
    {
        customerDb.CustomerOrderImageRequests.Update(request);
        return Task.CompletedTask;
    }

    public Task<List<CustomerOrderImage>> GetCustomerOrderImagesByRequestIdAsync(Guid requestId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImages
            .Where(x => x.RequestId == requestId && !x.IsDeleted)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountCustomerOrderImagesByRequestIdAsync(Guid requestId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerOrderImages
            .CountAsync(x => x.RequestId == requestId && !x.IsDeleted, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, List<string>>> GetCustomerOrderAssetTagsByOrderIdsAsync(
        IEnumerable<Guid> orderIds,
        CancellationToken cancellationToken)
    {
        var ids = orderIds.Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, List<string>>();

        var links = await customerDb.CustomerRentalOrderAssets
            .AsNoTracking()
            .Where(x => ids.Contains(x.CustomerRentalOrderId))
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
            return new Dictionary<Guid, List<string>>();

        var assetIds = links.Select(x => x.VendorProductAssetId).Distinct().ToList();
        var assetTags = await vendorDb.VendorProductAssets
            .AsNoTracking()
            .Where(a => assetIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.AssetTag, cancellationToken);

        var result = new Dictionary<Guid, List<string>>();
        foreach (var link in links)
        {
            if (!assetTags.TryGetValue(link.VendorProductAssetId, out var tag))
                continue;

            if (!result.TryGetValue(link.CustomerRentalOrderId, out var tags))
            {
                tags = [];
                result[link.CustomerRentalOrderId] = tags;
            }

            tags.Add(tag);
        }

        return result;
    }

    public Task RemoveCustomerRentalOrderAssetAsync(CustomerRentalOrderAsset asset, CancellationToken cancellationToken)
    {
        customerDb.CustomerRentalOrderAssets.Remove(asset);
        return Task.CompletedTask;
    }

    public async Task<CustomerRentalOrderWithListing?> GetActiveCustomerOrderForAssetAsync(Guid assetId, CancellationToken cancellationToken)
    {
        var orderAsset = await customerDb.CustomerRentalOrderAssets
            .Include(a => a.CustomerRentalOrder)
                .ThenInclude(o => o.Customer)
            .FirstOrDefaultAsync(a => a.VendorProductAssetId == assetId && !a.CustomerRentalOrder.IsDeleted && a.CustomerRentalOrder.Status == "active", cancellationToken);

        if (orderAsset is null || orderAsset.CustomerRentalOrder is null) return null;

        var order = orderAsset.CustomerRentalOrder;
        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);
        var productMap = listing is null
            ? null
            : await LoadProductsWithImagesAsync([listing.ProductId], cancellationToken);
        var img = ResolveOrderPrimaryImageUrl(listing, productMap);
        var withMedical = new CustomerRentalOrderWithListing(order, listing, img);
        return await AttachVariantDescriptionAsync(withMedical, cancellationToken);
    }

    public Task UpdateCustomerRentalOrderAsync(CustomerRentalOrder order, CancellationToken cancellationToken)

    {

        customerDb.CustomerRentalOrders.Update(order);

        return Task.CompletedTask;

    }

    public async Task AddCustomerOrderVendorOfferAsync(CustomerOrderVendorOffer offer, CancellationToken cancellationToken) =>
        await customerDb.CustomerOrderVendorOffers.AddAsync(offer, cancellationToken);

    public Task<List<CustomerOrderVendorOffer>> GetCustomerOrderVendorOffersAsync(Guid customerOrderId, CancellationToken cancellationToken) =>
        customerDb.CustomerOrderVendorOffers
            .Where(x => x.CustomerRentalOrderId == customerOrderId && !x.IsDeleted)
            .OrderBy(x => x.OfferRank)
            .ToListAsync(cancellationToken);

    public Task<CustomerOrderVendorOffer?> GetCustomerOrderVendorOfferAsync(Guid customerOrderId, Guid vendorId, CancellationToken cancellationToken) =>
        customerDb.CustomerOrderVendorOffers
            .FirstOrDefaultAsync(x =>
                x.CustomerRentalOrderId == customerOrderId &&
                x.VendorId == vendorId &&
                !x.IsDeleted,
                cancellationToken);

    public Task<List<CustomerOrderVendorOffer>> GetPendingVendorOffersAsync(Guid vendorId, CancellationToken cancellationToken)
    {
        var recent = DateTime.UtcNow.AddHours(-24);
        return customerDb.CustomerOrderVendorOffers
            .Where(x => x.VendorId == vendorId && !x.IsDeleted &&
                        (x.Status == "pending" || 
                        ((x.Status == "expired" || x.Status == "missed" || x.Status == "rejected") && x.CreatedOnUtc >= recent)))
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
    }

    public Task UpdateCustomerOrderVendorOfferAsync(CustomerOrderVendorOffer offer, CancellationToken cancellationToken)
    {
        customerDb.CustomerOrderVendorOffers.Update(offer);
        return Task.CompletedTask;
    }

    public async Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForCustomerAsync(
        Guid customerId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var orders = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o =>
                o.CustomerId == customerId &&
                !o.IsDeleted &&
                o.EndDate.HasValue &&
                o.EndDate.Value >= fromDate &&
                o.EndDate.Value <= toDate &&
                o.OrderType.ToLower() != "buy" &&
                o.Status == "active")
            .OrderBy(o => o.EndDate)
            .ToListAsync(cancellationToken);

        return await MapExpiringOrdersAsync(orders, cancellationToken);
    }

    public async Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForVendorAsync(
        Guid vendorId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var listingIds = await vendorDb.VendorProductListings
            .AsNoTracking()
            .Where(x => x.VendorId == vendorId && !x.IsDeleted)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (listingIds.Count == 0)
        {
            return [];
        }

        var orders = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o =>
                listingIds.Contains(o.VendorProductListingId) &&
                !o.IsDeleted &&
                o.EndDate.HasValue &&
                o.EndDate.Value >= fromDate &&
                o.EndDate.Value <= toDate &&
                o.OrderType.ToLower() != "buy" &&
                o.Status == "active")
            .OrderBy(o => o.EndDate)
            .ToListAsync(cancellationToken);

        return await MapExpiringOrdersAsync(orders, cancellationToken);
    }

    public async Task<List<ExpiringOrderAggregate>> GetExpiringOrdersForAdminAsync(
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var orders = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o =>
                !o.IsDeleted &&
                o.EndDate.HasValue &&
                o.EndDate.Value >= fromDate &&
                o.EndDate.Value <= toDate &&
                o.OrderType.ToLower() != "buy" &&
                o.Status == "active")
            .OrderBy(o => o.EndDate)
            .ToListAsync(cancellationToken);

        return await MapExpiringOrdersAsync(orders, cancellationToken);
    }



    public Task<List<CustomerNotification>> GetCustomerNotificationsAsync(Guid customerId, CancellationToken cancellationToken) =>

        customerDb.CustomerNotifications

            .AsNoTracking()

            .Where(n => n.CustomerId == customerId && !n.IsDeleted)

            .OrderByDescending(n => n.CreatedOnUtc)

            .ToListAsync(cancellationToken);



    public Task<CustomerNotification?> GetCustomerNotificationByIdAsync(Guid customerId, Guid notificationId, CancellationToken cancellationToken) =>

        customerDb.CustomerNotifications

            .FirstOrDefaultAsync(n => n.Id == notificationId && n.CustomerId == customerId && !n.IsDeleted, cancellationToken);



    public async Task AddCustomerNotificationAsync(CustomerNotification notification, CancellationToken cancellationToken) =>

        await customerDb.CustomerNotifications.AddAsync(notification, cancellationToken);



    public async Task<int> MarkAllCustomerNotificationsReadAsync(Guid customerId, CancellationToken cancellationToken)

    {

        var list = await customerDb.CustomerNotifications

            .Where(n => n.CustomerId == customerId && !n.IsDeleted && n.ReadAt == null)

            .ToListAsync(cancellationToken);

        var nowOffset = DateTimeOffset.UtcNow;

        var nowUtc = DateTime.UtcNow;

        foreach (var n in list)

        {

            n.ReadAt = nowOffset;

            n.ModifiedOnUtc = nowUtc;

        }

        return list.Count;

    }



    // --- Medical Directory (Admin-owned doctors + hospitals) ---

    public async Task<Prilixor.VendorPortal.Domain.Common.Doctor?> GetDoctorByIdAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        return await commonDb.Doctors
            .Include(d => d.Hospitals)
            .ThenInclude(hd => hd.Hospital)
            .FirstOrDefaultAsync(x => x.Id == doctorId && !x.IsDeleted, cancellationToken);
    }

    public async Task<Prilixor.VendorPortal.Domain.Common.Doctor?> FindDoctorByEmailAsync(
        string email,
        Guid? excludeDoctorId,
        CancellationToken cancellationToken)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalized))
            return null;

        var query = commonDb.Doctors.Where(x => !x.IsDeleted && x.Email.ToLower() == normalized);
        if (excludeDoctorId.HasValue)
            query = query.Where(x => x.Id != excludeDoctorId.Value);

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Prilixor.VendorPortal.Domain.Common.Doctor?> GetDoctorByUniqueCodeAsync(string uniqueCode, CancellationToken cancellationToken)
    {
        var code = uniqueCode.Trim().ToUpperInvariant();
        return await commonDb.Doctors
            .Include(d => d.Hospitals)
            .ThenInclude(hd => hd.Hospital)
            .FirstOrDefaultAsync(x => !x.IsDeleted && x.IsActive && x.UniqueCode == code, cancellationToken);
    }

    public async Task<List<Prilixor.VendorPortal.Domain.Common.Doctor>> SearchDoctorsAsync(string searchTerm, CancellationToken cancellationToken)
    {
        var query = commonDb.Doctors
            .Include(d => d.Hospitals)
            .ThenInclude(hd => hd.Hospital)
            .Where(x => !x.IsDeleted && x.IsActive);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = $"%{searchTerm.Trim()}%";
            var code = searchTerm.Trim().ToUpperInvariant();
            query = query.Where(x =>
                x.UniqueCode == code
                || EF.Functions.ILike(x.FullName, term)
                || EF.Functions.ILike(x.Specialization ?? "", term));
        }

        return await query.OrderBy(x => x.FullName).Take(50).ToListAsync(cancellationToken);
    }

    public async Task<List<Prilixor.VendorPortal.Domain.Common.Doctor>> ListDoctorsForAdminAsync(string? searchTerm, bool? isActive, CancellationToken cancellationToken)
    {
        var query = commonDb.Doctors
            .Include(d => d.Hospitals)
            .ThenInclude(hd => hd.Hospital)
            .Where(x => !x.IsDeleted);

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = $"%{searchTerm.Trim()}%";
            var code = searchTerm.Trim().ToUpperInvariant();
            query = query.Where(x =>
                x.UniqueCode == code
                || EF.Functions.ILike(x.FullName, term)
                || EF.Functions.ILike(x.Email, term)
                || EF.Functions.ILike(x.Specialization ?? "", term));
        }

        return await query.OrderByDescending(x => x.CreatedOnUtc).Take(200).ToListAsync(cancellationToken);
    }

    public async Task AddDoctorAsync(Prilixor.VendorPortal.Domain.Common.Doctor doctor, CancellationToken cancellationToken)
    {
        commonDb.Doctors.Add(doctor);
        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateDoctorAsync(Prilixor.VendorPortal.Domain.Common.Doctor doctor, CancellationToken cancellationToken)
    {
        commonDb.Doctors.Update(doctor);
        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task SoftDeleteDoctorAsync(Guid doctorId, Guid? deletedBy, CancellationToken cancellationToken)
    {
        var doctor = await commonDb.Doctors.FirstOrDefaultAsync(x => x.Id == doctorId && !x.IsDeleted, cancellationToken);
        if (doctor is null) return;
        doctor.IsDeleted = true;
        doctor.DeletedAt = DateTimeOffset.UtcNow;
        doctor.DeletedBy = deletedBy;
        doctor.IsActive = false;
        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> CountDoctorsEnrolledInYearAsync(string yearYy, CancellationToken cancellationToken)
    {
        var year = (yearYy ?? string.Empty).Trim();
        if (year.Length != 2)
            return 0;

        // Codes are DRxxYYNNN (e.g. DRPD26001). Sequence is year-wide, not per initials.
        var pattern = $"____{year}___";
        return await commonDb.Doctors.CountAsync(
            x => EF.Functions.Like(x.UniqueCode, pattern),
            cancellationToken);
    }

    public async Task SetDoctorHospitalLinksAsync(Guid doctorId, IReadOnlyList<Guid> hospitalIds, CancellationToken cancellationToken)
    {
        var existing = await commonDb.HospitalDoctors.Where(x => x.DoctorId == doctorId).ToListAsync(cancellationToken);
        commonDb.HospitalDoctors.RemoveRange(existing);

        var distinct = hospitalIds.Distinct().ToList();
        foreach (var hospitalId in distinct)
        {
            commonDb.HospitalDoctors.Add(new Prilixor.VendorPortal.Domain.Common.HospitalDoctor
            {
                DoctorId = doctorId,
                HospitalId = hospitalId,
            });
        }

        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<Prilixor.VendorPortal.Domain.Common.Hospital>> GetHospitalsForDoctorAsync(Guid doctorId, CancellationToken cancellationToken)
    {
        return await commonDb.HospitalDoctors
            .Where(x => x.DoctorId == doctorId)
            .Select(x => x.Hospital)
            .Where(h => !h.IsDeleted)
            .OrderBy(h => h.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<Prilixor.VendorPortal.Domain.Common.Hospital?> GetHospitalByIdAsync(Guid hospitalId, CancellationToken cancellationToken)
    {
        return await commonDb.Hospitals
            .Include(h => h.Doctors)
            .ThenInclude(hd => hd.Doctor)
            .FirstOrDefaultAsync(x => x.Id == hospitalId && !x.IsDeleted, cancellationToken);
    }

    public async Task<List<Prilixor.VendorPortal.Domain.Common.Hospital>> ListHospitalsForAdminAsync(string? searchTerm, bool? isActive, CancellationToken cancellationToken)
    {
        var query = commonDb.Hospitals
            .Include(h => h.Doctors)
            .ThenInclude(hd => hd.Doctor)
            .Where(x => !x.IsDeleted);

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = $"%{searchTerm.Trim()}%";
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, term)
                || EF.Functions.ILike(x.City ?? "", term)
                || EF.Functions.ILike(x.AddressLine1 ?? "", term));
        }

        return await query.OrderBy(x => x.Name).Take(200).ToListAsync(cancellationToken);
    }

    public async Task AddHospitalAsync(Prilixor.VendorPortal.Domain.Common.Hospital hospital, CancellationToken cancellationToken)
    {
        commonDb.Hospitals.Add(hospital);
        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateHospitalAsync(Prilixor.VendorPortal.Domain.Common.Hospital hospital, CancellationToken cancellationToken)
    {
        commonDb.Hospitals.Update(hospital);
        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task SoftDeleteHospitalAsync(Guid hospitalId, Guid? deletedBy, CancellationToken cancellationToken)
    {
        var hospital = await commonDb.Hospitals.FirstOrDefaultAsync(x => x.Id == hospitalId && !x.IsDeleted, cancellationToken);
        if (hospital is null) return;
        hospital.IsDeleted = true;
        hospital.DeletedAt = DateTimeOffset.UtcNow;
        hospital.DeletedBy = deletedBy;
        hospital.IsActive = false;

        var links = await commonDb.HospitalDoctors.Where(x => x.HospitalId == hospitalId).ToListAsync(cancellationToken);
        commonDb.HospitalDoctors.RemoveRange(links);

        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task SetHospitalDoctorLinksAsync(Guid hospitalId, IReadOnlyList<Guid> doctorIds, CancellationToken cancellationToken)
    {
        var existing = await commonDb.HospitalDoctors.Where(x => x.HospitalId == hospitalId).ToListAsync(cancellationToken);
        commonDb.HospitalDoctors.RemoveRange(existing);

        foreach (var doctorId in doctorIds.Distinct())
        {
            commonDb.HospitalDoctors.Add(new Prilixor.VendorPortal.Domain.Common.HospitalDoctor
            {
                HospitalId = hospitalId,
                DoctorId = doctorId,
            });
        }

        await commonDb.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<Prilixor.VendorPortal.Domain.Common.Doctor>> GetDoctorsForHospitalAsync(Guid hospitalId, CancellationToken cancellationToken)
    {
        return await commonDb.HospitalDoctors
            .Where(x => x.HospitalId == hospitalId)
            .Select(x => x.Doctor)
            .Where(d => !d.IsDeleted)
            .OrderBy(d => d.FullName)
            .ToListAsync(cancellationToken);
    }

    public Task SaveCommonChangesAsync(CancellationToken cancellationToken) =>
        commonDb.SaveChangesAsync(cancellationToken);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken) =>

        customerDb.SaveChangesAsync(cancellationToken);



    private async Task<VendorProductListing?> LoadListingWithVendorAsync(Guid listingId, CancellationToken cancellationToken) =>

        await vendorDb.VendorProductListings

            .AsNoTracking()

            .Include(l => l.Vendor)

            .ThenInclude(v => v.Profile)

            .Include(l => l.Images)

            .FirstOrDefaultAsync(l => l.Id == listingId && !l.IsDeleted, cancellationToken);



    private async Task<Dictionary<Guid, VendorProductListing>> LoadListingsWithVendorAsync(

        IReadOnlyCollection<Guid> listingIds,

        CancellationToken cancellationToken)

    {

        var ids = listingIds.Distinct().ToList();

        if (ids.Count == 0)

            return new Dictionary<Guid, VendorProductListing>();



        var listings = await vendorDb.VendorProductListings

            .AsNoTracking()

            .Include(l => l.Vendor)

            .ThenInclude(v => v.Profile)

            .Include(l => l.Images)

            .Where(l => ids.Contains(l.Id) && !l.IsDeleted)

            .ToListAsync(cancellationToken);



        return listings.ToDictionary(l => l.Id);

    }

    private async Task<List<CustomerRentalOrderWithListing>> AttachVariantDescriptionsAsync(
        List<CustomerRentalOrderWithListing> items,
        CancellationToken cancellationToken)
    {
        var variantIds = items
            .Select(x => x.Order.ProductVariantId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (variantIds.Count == 0) return items;

        var variants = await commonDb.Set<ProductVariant>()
            .AsNoTracking()
            .Where(v => variantIds.Contains(v.Id))
            .ToDictionaryAsync(v => v.Id, cancellationToken);

        return items.Select(item =>
        {
            if (item.Order.ProductVariantId.HasValue &&
                variants.TryGetValue(item.Order.ProductVariantId.Value, out var variant))
            {
                var desc = Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(variant.SizeValue, variant.SizeUnit);
                return item with { VariantDescription = desc };
            }
            return item;
        }).ToList();
    }

    private async Task<CustomerRentalOrderWithListing?> AttachVariantDescriptionAsync(
        CustomerRentalOrderWithListing? item,
        CancellationToken cancellationToken)
    {
        if (item?.Order.ProductVariantId == null) return item;

        var variant = await commonDb.Set<ProductVariant>()
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == item.Order.ProductVariantId.Value, cancellationToken);

        if (variant is not null)
        {
            var desc = Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(variant.SizeValue, variant.SizeUnit);
            return item with { VariantDescription = desc };
        }
        return item;
    }

    private async Task<List<ExpiringOrderAggregate>> MapExpiringOrdersAsync(
        IReadOnlyCollection<CustomerRentalOrder> orders,
        CancellationToken cancellationToken)
    {
        if (orders.Count == 0)
        {
            return [];
        }

        var listingIds = orders.Select(o => o.VendorProductListingId).Distinct().ToList();
        var listings = await vendorDb.VendorProductListings
            .AsNoTracking()
            .Include(x => x.Vendor).ThenInclude(v => v.Profile)
            .Include(x => x.Images)
            .Where(x => listingIds.Contains(x.Id) && !x.IsDeleted)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var productMap = await LoadProductsWithImagesAsync(
            listings.Values.Select(l => l.ProductId),
            cancellationToken);

        var result = new List<ExpiringOrderAggregate>(orders.Count);
        foreach (var order in orders)
        {
            if (!order.EndDate.HasValue)
                continue;

            var listing = listings.GetValueOrDefault(order.VendorProductListingId);
            if (listing is null)
                continue;

            var vendorName = listing.Vendor.Profile?.BusinessName;
            if (string.IsNullOrWhiteSpace(vendorName))
            {
                vendorName = listing.Vendor.Email;
            }

            result.Add(new ExpiringOrderAggregate(
                order.Id,
                order.OrderNumber,
                order.CustomerId,
                order.Customer?.FullName ?? "Customer",
                listing.VendorId,
                vendorName ?? "Vendor",
                listing.Id,
                listing.ListingTitle,
                order.Status,
                order.OrderType,
                order.EndDate.Value,
                order.EndDate.Value.DayNumber - DateOnly.FromDateTime(DateTime.UtcNow).DayNumber,
                ResolveOrderPrimaryImageUrl(listing, productMap)));
        }

        return result;
    }



    private async Task<IReadOnlyDictionary<Guid, RentalDurationIcon>> GetLiveRentalDurationIconsAsync(
        CancellationToken cancellationToken)
    {
        var rows = await commonDb.RentalDurationIcons
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            rows = await vendorDb.RentalDurationIcons
                .AsNoTracking()
                .Where(x => !x.IsDeleted && x.IsActive)
                .ToListAsync(cancellationToken);
        }

        return RentalDurationIconLiveResolve.ToLookup(rows);
    }

    private async Task<List<RentalDurationMaster>> GetActiveRentalDurationMastersAsync(
        CancellationToken cancellationToken)
    {
        var rows = await commonDb.RentalDurationMasters
            .AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive && x.DurationDays > 0)
            .OrderBy(x => x.DurationDays)
            .ThenBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            rows = await vendorDb.RentalDurationMasters
                .AsNoTracking()
                .Where(x => !x.IsDeleted && x.IsActive && x.DurationDays > 0)
                .OrderBy(x => x.DurationDays)
                .ThenBy(x => x.SortOrder)
                .ToListAsync(cancellationToken);
        }

        return rows;
    }

    private VendorProductListingAggregate ToAggregate(
        VendorProductListing listing,
        Product product,
        List<Prilixor.VendorPortal.Domain.Vendors.VendorVariantInventory> variantInventory,
        IReadOnlyDictionary<Guid, RentalDurationIcon>? liveIcons = null,
        IReadOnlyList<RentalDurationMaster>? durationMasters = null,
        int? productTotalAvailableQuantity = null,
        List<VariantInventoryItem>? marketplaceVariantInventory = null)
    {
        var inv = listing.Inventory;
        var imgs = ResolveOrderedDistinctListingImageUrls(listing.Images);
        if (imgs.Count == 0)
        {
            imgs = ResolveOrderedDistinctProductImageUrls(product.ProductImages);
        }
        var desc = string.IsNullOrWhiteSpace(product.LongDescription)
            ? product.ShortDescription ?? string.Empty
            : product.LongDescription!;
        var listingAvailable = CatalogListingAvailability.ResolveAvailableQuantity(
            product.Category?.IsChemical == true || product.ChemicalProperty != null,
            inv?.AvailableQuantity ?? listing.AvailableQuantity,
            variantInventory.Count > 0 ? variantInventory.Sum(vi => vi.AvailableQuantity) : null);

        return new VendorProductListingAggregate
        {
            ListingId = listing.Id,
            ProductId = listing.ProductId,
            VendorId = listing.VendorId,
            VendorAccountStatus = listing.Vendor.AccountStatus,
            VendorBusinessName = string.IsNullOrWhiteSpace(listing.Vendor.Profile?.BusinessName)
                ? listing.Vendor.Email
                : listing.Vendor.Profile!.BusinessName,
            VendorLatitude = listing.Vendor.Profile?.Latitude,
            VendorLongitude = listing.Vendor.Profile?.Longitude,
            ListingTitle = string.IsNullOrWhiteSpace(product.ProductName)
                ? listing.ListingTitle
                : product.ProductName,
            ListingStatus = listing.ListingStatus,
            DailyRent = product.DailyRent,
            WeeklyRent = product.WeeklyRent,
            MonthlyRent = product.MonthlyRent,
            SecurityDeposit = product.SecurityDeposit,
            BuyPrice = product.BuyPrice,
            VendorDailyRent = product.VendorDailyRent,
            VendorWeeklyRent = product.VendorWeeklyRent,
            VendorMonthlyRent = product.VendorMonthlyRent,
            VendorSecurityDeposit = product.VendorSecurityDeposit,
            VendorBuyPrice = product.VendorBuyPrice,
            GstPercent = product.GstPercent,
            IsRentEnabled = product.IsRentEnabled,
            IsBuyEnabled = product.IsBuyEnabled,
            IsChemical = product.Category?.IsChemical ?? false,
            ListingAvailableQuantity = listing.AvailableQuantity,
            CategoryPrescriptionRequired = product.Category?.PrescriptionRequired ?? false,
            CategoryDepositRequired = product.Category?.DepositRequired ?? false,
            CategoryName = product.Category?.CategoryName ?? "General",
            Description = desc,
            ImageUrls = imgs,
            InventoryId = inv?.Id,
            InventoryAvailable = listingAvailable,
            ProductTotalAvailableQuantity = productTotalAvailableQuantity ?? listingAvailable,
            MarketplaceVariantInventory = marketplaceVariantInventory
                ?? variantInventory
                    .Select(vi => new VariantInventoryItem(vi.ProductVariantId, vi.AvailableQuantity))
                    .ToList(),
            InventoryReserved = inv?.ReservedQuantity ?? 0,
            InventoryTotal = inv?.TotalQuantity ?? listing.AvailableQuantity,
            InventoryRented = inv?.RentedQuantity ?? 0,
            InventoryBlocked = inv?.BlockedQuantity ?? 0,
            CasNumber = product.ChemicalProperty?.CasNumber,
            ChemicalFormula = product.ChemicalProperty?.ChemicalFormula,
            PurityPercentage = product.ChemicalProperty?.PurityPercentage,
            MolecularWeight = product.ChemicalProperty?.MolecularWeight,
            BaseUnit = product.ChemicalProperty?.BaseUnit,
            SdsDocumentUrl = product.ChemicalProperty?.SdsDocumentUrl,
            CoaDocumentUrl = product.ChemicalProperty?.CoaDocumentUrl,
            Documents = ProductCatalogDocuments.ToDtos(product, fileUrlResolver),
            Variants = product.Variants?.Select(v => new Prilixor.VendorPortal.Application.Onboarding.ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            RentalPricingPlans = ProductRentalPricingPlanSync.ToProjectedDtos(
                product,
                durationMasters ?? [],
                rentalPricingOptions.Value,
                fileUrlResolver,
                liveIcons),
            VariantInventory = variantInventory
                .Select(vi => new VariantInventoryItem(vi.ProductVariantId, vi.AvailableQuantity))
                .ToList(),
        };
    }

    private List<string> ResolveOrderedDistinctListingImageUrls(IEnumerable<VendorProductImage> images)

    {

        var ordered = images.Where(i => !i.IsDeleted)

            .OrderByDescending(i => i.IsPrimary)

            .ThenBy(i => i.DisplayOrder);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var list = new List<string>();

        foreach (var im in ordered)

        {

            var key = (im.ImageUrl ?? string.Empty).Trim();

            if (string.IsNullOrEmpty(key)) continue;

            if (!seen.Add(key)) continue;

            list.Add(fileUrlResolver.Resolve(im.ImageUrl));

        }

        return list;

    }

    private List<string> ResolveOrderedDistinctProductImageUrls(IEnumerable<ProductImage> images)
    {
        var ordered = images.Where(i => !i.IsDeleted)
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.DisplayOrder);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var list = new List<string>();
        foreach (var im in ordered)
        {
            var key = (im.ImageUrl ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(key)) continue;
            if (!seen.Add(key)) continue;
            list.Add(fileUrlResolver.Resolve(im.ImageUrl));
        }

        return list;
    }



    private string? ResolveStoredImageUrl(string? imageUrl, string? thumbnailUrl)
    {
        // Same as production: prefer thumbnail when present, then original.
        var thumb = thumbnailUrl?.Trim();
        if (!string.IsNullOrEmpty(thumb))
            return fileUrlResolver.Resolve(thumb);

        var original = imageUrl?.Trim();
        if (!string.IsNullOrEmpty(original))
            return fileUrlResolver.Resolve(original);

        return null;
    }

    private string? ResolvePrimaryListingImageUrl(IEnumerable<VendorProductImage> images)
    {
        var primary = images.Where(i => !i.IsDeleted)
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.DisplayOrder)
            .FirstOrDefault();
        if (primary is null) return null;
        return ResolveStoredImageUrl(primary.ImageUrl, primary.ThumbnailUrl);
    }

    private string? ResolvePrimaryProductImageUrl(IEnumerable<ProductImage> images)
    {
        var primary = images.Where(i => !i.IsDeleted)
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.DisplayOrder)
            .FirstOrDefault();
        if (primary is null) return null;
        return ResolveStoredImageUrl(primary.ImageUrl, primary.ThumbnailUrl);
    }

    /// <summary>
    /// Prefer listing primary image; fall back to product primary image (same as Browse catalog).
    /// </summary>
    private string? ResolveOrderPrimaryImageUrl(
        VendorProductListing? listing,
        IReadOnlyDictionary<Guid, Product>? productMap = null)
    {
        if (listing is null) return null;
        var listingUrl = ResolvePrimaryListingImageUrl(listing.Images);
        if (!string.IsNullOrWhiteSpace(listingUrl)) return listingUrl;
        if (productMap is null) return null;
        var product = productMap.GetValueOrDefault(listing.ProductId);
        return ResolvePrimaryProductImageUrl(product?.ProductImages ?? []);
    }

    private async Task<Dictionary<Guid, Product>> LoadProductsWithImagesAsync(
        IEnumerable<Guid> productIds,
        CancellationToken cancellationToken)
    {
        var ids = productIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, Product>();

        var products = await commonDb.Products
            .AsNoTracking()
            .Include(p => p.ProductImages)
            .Where(p => ids.Contains(p.Id) && !p.IsDeleted)
            .ToListAsync(cancellationToken);

        return products.ToDictionary(p => p.Id);
    }

    public Task<CustomerNotificationPreference?> GetCustomerNotificationPreferenceAsync(Guid customerId, CancellationToken cancellationToken) =>
        customerDb.CustomerNotificationPreferences.FirstOrDefaultAsync(p => p.CustomerId == customerId && !p.IsDeleted, cancellationToken);

    public async Task AddCustomerNotificationPreferenceAsync(CustomerNotificationPreference preference, CancellationToken cancellationToken) =>
        await customerDb.CustomerNotificationPreferences.AddAsync(preference, cancellationToken);

    public Task UpdateCustomerNotificationPreferenceAsync(CustomerNotificationPreference preference, CancellationToken cancellationToken)
    {
        customerDb.CustomerNotificationPreferences.Update(preference);
        return Task.CompletedTask;
    }

    public Task<List<ChatSession>> GetCustomerChatSessionsAsync(Guid customerId, CancellationToken cancellationToken) =>
        customerDb.ChatSessions.Where(s => s.CustomerId == customerId && !s.IsDeleted).OrderByDescending(s => s.LastMessageAt).ToListAsync(cancellationToken);

    public Task<List<ChatSession>> GetVendorChatSessionsAsync(Guid vendorId, CancellationToken cancellationToken) =>
        customerDb.ChatSessions
            .Where(s => s.VendorId == vendorId
                        && !s.IsDeleted
                        && s.CounterpartyType == ChatCounterpartyTypes.Vendor)
            .OrderByDescending(s => s.LastMessageAt)
            .ToListAsync(cancellationToken);

    public Task<List<ChatSession>> GetAdminChatSessionsAsync(CancellationToken cancellationToken) =>
        customerDb.ChatSessions
            .Where(s => !s.IsDeleted && s.CounterpartyType == ChatCounterpartyTypes.Admin)
            .OrderByDescending(s => s.LastMessageAt)
            .ToListAsync(cancellationToken);

    public Task<ChatSession?> GetChatSessionAsync(Guid customerId, Guid vendorId, Guid? orderId, CancellationToken cancellationToken)
    {
        if (orderId.HasValue)
        {
            return customerDb.ChatSessions.FirstOrDefaultAsync(s =>
                s.CustomerId == customerId
                && s.VendorId == vendorId
                && s.OrderId == orderId
                && s.CounterpartyType == ChatCounterpartyTypes.Vendor
                && !s.IsDeleted, cancellationToken);
        }
        return customerDb.ChatSessions.FirstOrDefaultAsync(s =>
            s.CustomerId == customerId
            && s.VendorId == vendorId
            && s.OrderId == null
            && s.CounterpartyType == ChatCounterpartyTypes.Vendor
            && !s.IsDeleted, cancellationToken);
    }

    public Task<ChatSession?> GetAdminChatSessionForOrderAsync(Guid customerId, Guid orderId, CancellationToken cancellationToken) =>
        customerDb.ChatSessions.FirstOrDefaultAsync(s =>
            s.CustomerId == customerId
            && s.OrderId == orderId
            && s.CounterpartyType == ChatCounterpartyTypes.Admin
            && !s.IsDeleted, cancellationToken);

    public Task<ChatSession?> GetChatSessionByIdAsync(Guid sessionId, CancellationToken cancellationToken) =>
        customerDb.ChatSessions.FirstOrDefaultAsync(s => s.Id == sessionId && !s.IsDeleted, cancellationToken);

    public async Task AddChatSessionAsync(ChatSession session, CancellationToken cancellationToken) =>
        await customerDb.ChatSessions.AddAsync(session, cancellationToken);

    public Task UpdateChatSessionAsync(ChatSession session, CancellationToken cancellationToken)
    {
        customerDb.ChatSessions.Update(session);
        return Task.CompletedTask;
    }

    public Task<List<ChatMessage>> GetChatMessagesAsync(Guid sessionId, CancellationToken cancellationToken) =>
        customerDb.ChatMessages.Where(m => m.ChatSessionId == sessionId && !m.IsDeleted).OrderBy(m => m.SentAt).ToListAsync(cancellationToken);

    public async Task AddChatMessageAsync(ChatMessage message, CancellationToken cancellationToken) =>
        await customerDb.ChatMessages.AddAsync(message, cancellationToken);

    public Task<int> CountUnreadChatMessagesAsync(Guid sessionId, string senderType, CancellationToken cancellationToken) =>
        customerDb.ChatMessages.CountAsync(
            m => m.ChatSessionId == sessionId
                 && !m.IsDeleted
                 && !m.IsRead
                 && m.SenderType == senderType,
            cancellationToken);

    public Task<int> CountUnreadAdminInboxMessagesAsync(CancellationToken cancellationToken) =>
        customerDb.ChatMessages
            .Where(m => !m.IsDeleted
                        && !m.IsRead
                        && m.SenderType == "Customer"
                        && m.ChatSession!.CounterpartyType == ChatCounterpartyTypes.Admin
                        && !m.ChatSession.IsDeleted)
            .CountAsync(cancellationToken);

    public async Task<Dictionary<Guid, int>> GetUnreadChatCountsBySessionAsync(
        IReadOnlyCollection<Guid> sessionIds,
        string senderType,
        CancellationToken cancellationToken)
    {
        if (sessionIds.Count == 0)
            return new Dictionary<Guid, int>();

        var rows = await customerDb.ChatMessages
            .Where(m => sessionIds.Contains(m.ChatSessionId)
                        && !m.IsDeleted
                        && !m.IsRead
                        && m.SenderType == senderType)
            .GroupBy(m => m.ChatSessionId)
            .Select(g => new { SessionId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(x => x.SessionId, x => x.Count);
    }

    public async Task<int> MarkChatMessagesReadAsync(Guid sessionId, string senderType, CancellationToken cancellationToken)
    {
        var messages = await customerDb.ChatMessages
            .Where(m => m.ChatSessionId == sessionId
                        && !m.IsDeleted
                        && !m.IsRead
                        && m.SenderType == senderType)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0)
            return 0;

        var now = DateTime.UtcNow;
        foreach (var m in messages)
        {
            m.IsRead = true;
            m.ModifiedOnUtc = now;
        }

        return messages.Count;
    }

    public Task<string?> GetVendorBusinessNameAsync(Guid vendorId, CancellationToken cancellationToken) =>
        vendorDb.VendorProfiles.Where(p => p.VendorId == vendorId).Select(p => p.BusinessName).FirstOrDefaultAsync(cancellationToken);

    public Task<List<CustomerFavorite>> GetCustomerFavoritesAsync(Guid customerId, CancellationToken cancellationToken) =>
        customerDb.CustomerFavorites
            .Where(f => f.CustomerId == customerId)
            .OrderByDescending(f => f.AddedAtUtc)
            .ToListAsync(cancellationToken);

    public Task<CustomerFavorite?> GetCustomerFavoriteAsync(Guid customerId, Guid vendorProductListingId, CancellationToken cancellationToken) =>
        customerDb.CustomerFavorites
            .FirstOrDefaultAsync(f => f.CustomerId == customerId && f.VendorProductListingId == vendorProductListingId, cancellationToken);

    public async Task AddCustomerFavoriteAsync(CustomerFavorite favorite, CancellationToken cancellationToken) =>
        await customerDb.CustomerFavorites.AddAsync(favorite, cancellationToken);

    public Task RemoveCustomerFavoriteAsync(CustomerFavorite favorite, CancellationToken cancellationToken)
    {
        customerDb.CustomerFavorites.Remove(favorite);
        return Task.CompletedTask;
    }

    public Task<List<Guid>> GetCustomersByFavoriteListingAsync(Guid vendorProductListingId, CancellationToken cancellationToken) =>
        customerDb.CustomerFavorites
            .Where(f => f.VendorProductListingId == vendorProductListingId)
            .Select(f => f.CustomerId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public async Task<Dictionary<Guid, int>> GetFavoriteCountsByListingsAsync(List<Guid> listingIds, CancellationToken cancellationToken)
    {
        var counts = await customerDb.CustomerFavorites
            .Where(f => listingIds.Contains(f.VendorProductListingId))
            .GroupBy(f => f.VendorProductListingId)
            .Select(g => new { ListingId = g.Key, Count = g.Select(x => x.CustomerId).Distinct().Count() })
            .ToDictionaryAsync(x => x.ListingId, x => x.Count, cancellationToken);
            
        return counts;
    }

    public async Task<Dictionary<Guid, int>> GetFavoriteCountsByProductsAsync(CancellationToken cancellationToken)
    {
        var listingFavorites = await customerDb.CustomerFavorites
            .GroupBy(f => f.VendorProductListingId)
            .Select(g => new { ListingId = g.Key, Count = g.Select(x => x.CustomerId).Distinct().Count() })
            .ToListAsync(cancellationToken);

        var listingIds = listingFavorites.Select(x => x.ListingId).ToList();
        if (listingIds.Count == 0) return new Dictionary<Guid, int>();

        var listingToProduct = await vendorDb.VendorProductListings
            .Where(l => listingIds.Contains(l.Id))
            .Select(l => new { l.Id, l.ProductId })
            .ToListAsync(cancellationToken);

        var productMap = listingToProduct.ToDictionary(x => x.Id, x => x.ProductId);

        var result = new Dictionary<Guid, int>();
        foreach (var lf in listingFavorites)
        {
            if (productMap.TryGetValue(lf.ListingId, out var productId))
            {
                if (result.ContainsKey(productId))
                {
                    result[productId] += lf.Count;
                }
                else
                {
                    result[productId] = lf.Count;
                }
            }
        }

        return result;
    }

    public async Task<List<AdminCustomerListItemDto>> SearchCustomersForAdminAsync(string? search, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var q = customerDb.Customers.AsNoTracking().Where(c => !c.IsDeleted);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            q = q.Where(c => c.Email.Contains(s) || c.FullName.ToLower().Contains(s) || (c.Phone != null && c.Phone.Contains(s)));
        }

        var customers = await q
            .OrderByDescending(c => c.CreatedOnUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var ids = customers.Select(c => c.Id).ToList();
        var orderCounts = await customerDb.CustomerRentalOrders
            .AsNoTracking()
            .Where(o => ids.Contains(o.CustomerId) && !o.IsDeleted)
            .GroupBy(o => o.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var countMap = orderCounts.ToDictionary(x => x.CustomerId, x => x.Count);

        return customers.Select(c => new AdminCustomerListItemDto(
            c.Id.ToString(),
            c.Email,
            c.FullName,
            c.Phone,
            c.IsEmailVerified,
            c.LastLoginAt,
            c.CreatedOnUtc,
            countMap.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<AdminCustomerDetailDto?> GetCustomerDetailForAdminAsync(Guid customerId, CancellationToken cancellationToken)
    {
        var c = await customerDb.Customers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == customerId && !x.IsDeleted, cancellationToken);
        if (c is null) return null;

        var addresses = await customerDb.CustomerAddresses.AsNoTracking()
            .Where(a => a.CustomerId == customerId && !a.IsDeleted)
            .OrderByDescending(a => a.IsDefault)
            .ThenBy(a => a.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        var orders = await customerDb.CustomerRentalOrders.AsNoTracking()
            .Where(o => o.CustomerId == customerId && !o.IsDeleted)
            .OrderByDescending(o => o.CreatedOnUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        return new AdminCustomerDetailDto(
            c.Id.ToString(),
            c.Email,
            c.FullName,
            c.Phone,
            c.IsEmailVerified,
            c.LastLoginAt,
            c.CreatedOnUtc,
            addresses.Select(a => new AdminCustomerAddressDto(
                a.Id.ToString(), a.Label, a.Line1, a.City, a.State, a.Postal, a.IsDefault)).ToList(),
            orders.Select(o => new AdminCustomerOrderSummaryDto(
                o.Id.ToString(), o.OrderNumber, o.Status, o.TotalAmount, o.CreatedOnUtc,
                o.PlacedByAdminId?.ToString())).ToList());
    }

    public async Task<List<AdminOrderableListingDto>> SearchOrderableListingsForAdminAsync(
        string? search, int take, bool? isChemical, CancellationToken cancellationToken)
    {
        var q = vendorDb.VendorProductListings
            .AsNoTracking()
            .Include(l => l.Vendor)
            .ThenInclude(v => v.Profile)
            .Include(l => l.Images)
            .Include(l => l.Inventory)
            .Where(l =>
                !l.IsDeleted &&
                (EF.Functions.ILike(l.ListingStatus, "active") ||
                 EF.Functions.ILike(l.ListingStatus, "approved")) &&
                !l.Vendor.IsDeleted &&
                EF.Functions.ILike(l.Vendor.AccountStatus, "active"));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(l =>
                EF.Functions.ILike(l.ListingTitle, $"%{s}%") ||
                (l.Vendor.Profile != null && EF.Functions.ILike(l.Vendor.Profile.BusinessName, $"%{s}%")));
        }

        var rows = await q
            .OrderByDescending(l => l.CreatedOnUtc)
            .Take(Math.Max(take * 4, 80))
            .ToListAsync(cancellationToken);

        if (rows.Count == 0 && string.IsNullOrWhiteSpace(search))
            return [];

        var productIds = rows.Select(r => r.ProductId).Distinct().ToList();
        var productQuery = commonDb.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.ProductImages)
            .Include(p => p.Variants)
            .Include(p => p.RentalPricingPlans)
            .Where(p => !p.IsDeleted && p.IsActive && productIds.Contains(p.Id));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            // Also pull products matching name/brand so we can include their vendor listings
            var matchedProductIds = await commonDb.Products
                .AsNoTracking()
                .Where(p => !p.IsDeleted && p.IsActive && (
                    EF.Functions.ILike(p.ProductName, $"%{s}%") ||
                    (p.BrandName != null && EF.Functions.ILike(p.BrandName, $"%{s}%")) ||
                    (p.ModelName != null && EF.Functions.ILike(p.ModelName, $"%{s}%")) ||
                    (p.Category != null && EF.Functions.ILike(p.Category.CategoryName, $"%{s}%"))))
                .Select(p => p.Id)
                .Take(100)
                .ToListAsync(cancellationToken);

            if (matchedProductIds.Count > 0)
            {
                var extraRows = await vendorDb.VendorProductListings
                    .AsNoTracking()
                    .Include(l => l.Vendor)
                    .ThenInclude(v => v.Profile)
                    .Include(l => l.Images)
                    .Include(l => l.Inventory)
                    .Where(l =>
                        !l.IsDeleted &&
                        matchedProductIds.Contains(l.ProductId) &&
                        (EF.Functions.ILike(l.ListingStatus, "active") ||
                         EF.Functions.ILike(l.ListingStatus, "approved")) &&
                        !l.Vendor.IsDeleted &&
                        EF.Functions.ILike(l.Vendor.AccountStatus, "active"))
                    .OrderByDescending(l => l.CreatedOnUtc)
                    .Take(200)
                    .ToListAsync(cancellationToken);

                rows = rows
                    .Concat(extraRows)
                    .GroupBy(r => r.Id)
                    .Select(g => g.First())
                    .ToList();

                productIds = rows.Select(r => r.ProductId).Distinct().ToList();
                productQuery = commonDb.Products
                    .AsNoTracking()
                    .Include(p => p.Category)
                    .Include(p => p.ProductImages)
                    .Include(p => p.Variants)
                    .Include(p => p.RentalPricingPlans)
                    .Where(p => !p.IsDeleted && p.IsActive && productIds.Contains(p.Id));
            }
        }

        var products = await productQuery.ToListAsync(cancellationToken);
        var productMap = products.ToDictionary(p => p.Id);

        IEnumerable<VendorProductListing> filtered = rows;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            filtered = filtered.Where(r =>
            {
                var product = productMap.GetValueOrDefault(r.ProductId);
                var productName = product?.ProductName ?? string.Empty;
                var brand = product?.BrandName ?? string.Empty;
                var model = product?.ModelName ?? string.Empty;
                var category = product?.Category?.CategoryName ?? string.Empty;
                return productName.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       brand.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       model.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       category.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       r.ListingTitle.Contains(s, StringComparison.OrdinalIgnoreCase) ||
                       (r.Vendor.Profile?.BusinessName?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false);
            });
        }

        if (isChemical.HasValue)
        {
            filtered = filtered.Where(r =>
            {
                var product = productMap.GetValueOrDefault(r.ProductId);
                return (product?.Category?.IsChemical ?? false) == isChemical.Value;
            });
        }

        var filteredList = filtered.ToList();
        var variantAvailableSums = await GetVariantAvailableSumsAsync(
            filteredList.Select(l => l.Id).Distinct().ToList(),
            cancellationToken);

        int Qty(VendorProductListing listing) =>
            ResolvePublicAvailableQuantity(
                listing,
                productMap.GetValueOrDefault(listing.ProductId),
                variantAvailableSums);

        return filteredList
            .OrderByDescending(r => Qty(r) > 0 ? 1 : 0)
            .ThenBy(r => r.ListingTitle)
            .Take(take)
            .Select(l =>
            {
                var product = productMap.GetValueOrDefault(l.ProductId);
                var vendorName = l.Vendor.Profile?.BusinessName;
                if (string.IsNullOrWhiteSpace(vendorName))
                    vendorName = l.Vendor.Email;
                var primaryUrl = ResolvePrimaryListingImageUrl(l.Images)
                    ?? ResolvePrimaryProductImageUrl(product?.ProductImages ?? []);
                var availableQuantity = Qty(l);
                var availabilityStatus = CatalogListingAvailability.ToStatus(availableQuantity);
                var (buyPrice, maxBuyPrice) = ResolveCatalogBuyPrices(product);

                return new AdminOrderableListingDto(
                    l.Id.ToString(),
                    l.VendorId.ToString(),
                    l.ProductId.ToString(),
                    string.IsNullOrWhiteSpace(product?.ProductName)
                        ? (string.IsNullOrWhiteSpace(l.ListingTitle) ? "Listing" : l.ListingTitle)
                        : product.ProductName,
                    vendorName ?? "Vendor",
                    product?.Category?.CategoryName ?? "General",
                    product?.Category?.IsChemical ?? false,
                    product?.IsRentEnabled ?? true,
                    product?.IsBuyEnabled ?? false,
                    product?.DailyRent ?? l.DailyRent,
                    product?.WeeklyRent ?? l.WeeklyRent,
                    product?.MonthlyRent ?? l.MonthlyRent,
                    product?.SecurityDeposit ?? l.SecurityDeposit,
                    buyPrice,
                    maxBuyPrice,
                    availableQuantity,
                    availabilityStatus,
                    l.ListingStatus,
                    primaryUrl,
                    product?.Category?.PrescriptionRequired ?? false);
            })
            .ToList();
    }

    public Task<bool> HasActiveOrdersForListingAsync(Guid listingId, CancellationToken cancellationToken)
    {
        var activeStatuses = new[] { "pending", "awaiting_vendor_acceptance", "confirmed", "in_transit", "active" };
        return customerDb.CustomerRentalOrders
            .AnyAsync(o => o.VendorProductListingId == listingId 
                           && activeStatuses.Contains(o.Status) 
                           && !o.IsDeleted, 
                       cancellationToken);
    }

    public Task<List<CustomerRentalOrderExtension>> GetPendingCustomerRentalOrderExtensionsAsync(Guid orderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerRentalOrderExtensions
            .Where(x => x.CustomerRentalOrderId == orderId && !x.IsDeleted && x.Status == "pending_approval")
            .ToListAsync(cancellationToken);
    }

    public Task<List<CustomerRentalOrderBuyout>> GetPendingCustomerRentalOrderBuyoutsAsync(Guid orderId, CancellationToken cancellationToken)
    {
        return customerDb.CustomerRentalOrderBuyouts
            .Where(x => x.CustomerRentalOrderId == orderId && !x.IsDeleted && x.Status == "pending_approval")
            .ToListAsync(cancellationToken);
    }

    public async Task<List<PendingContinuationAggregate>> GetAllPendingContinuationsForAdminAsync(CancellationToken cancellationToken)
    {
        var extensions = await customerDb.CustomerRentalOrderExtensions
            .AsNoTracking()
            .Include(x => x.CustomerRentalOrder)
                .ThenInclude(o => o.Customer)
            .Where(x => !x.IsDeleted && x.Status == "pending_approval")
            .ToListAsync(cancellationToken);

        var buyouts = await customerDb.CustomerRentalOrderBuyouts
            .AsNoTracking()
            .Include(x => x.CustomerRentalOrder)
                .ThenInclude(o => o.Customer)
            .Where(x => !x.IsDeleted && x.Status == "pending_approval")
            .ToListAsync(cancellationToken);

        var listingIds = extensions.Select(x => x.CustomerRentalOrder.VendorProductListingId)
            .Union(buyouts.Select(x => x.CustomerRentalOrder.VendorProductListingId))
            .Distinct()
            .ToList();

        var map = await LoadListingsWithVendorAsync(listingIds, cancellationToken);

        var variantIds = extensions.Select(x => x.CustomerRentalOrder.ProductVariantId)
            .Concat(buyouts.Select(x => x.CustomerRentalOrder.ProductVariantId))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var variants = variantIds.Count > 0
            ? await commonDb.Set<ProductVariant>()
                .AsNoTracking()
                .Where(v => variantIds.Contains(v.Id))
                .ToDictionaryAsync(v => v.Id, cancellationToken)
            : new Dictionary<Guid, ProductVariant>();

        string ComposeTitle(VendorProductListing? listing, CustomerRentalOrder order)
        {
            var title = listing?.ListingTitle ?? "Deleted Product";
            if (order.ProductVariantId.HasValue && variants.TryGetValue(order.ProductVariantId.Value, out var variant))
            {
                title += $" ({Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(variant.SizeValue, variant.SizeUnit)})";
            }
            return title;
        }

        var result = new List<PendingContinuationAggregate>();

        foreach (var e in extensions)
        {
            var listing = map.GetValueOrDefault(e.CustomerRentalOrder.VendorProductListingId);
            result.Add(new PendingContinuationAggregate(
                e.Id,
                e.CustomerRentalOrderId,
                e.CustomerRentalOrder.OrderNumber,
                e.CustomerRentalOrder.Customer?.FullName ?? "Customer",
                listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor",
                ComposeTitle(listing, e.CustomerRentalOrder),
                e.TotalAmount,
                e.CreatedOnUtc,
                "extension"
            ));
        }

        foreach (var b in buyouts)
        {
            var listing = map.GetValueOrDefault(b.CustomerRentalOrder.VendorProductListingId);
            result.Add(new PendingContinuationAggregate(
                b.Id,
                b.CustomerRentalOrderId,
                b.CustomerRentalOrder.OrderNumber,
                b.CustomerRentalOrder.Customer?.FullName ?? "Customer",
                listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor",
                ComposeTitle(listing, b.CustomerRentalOrder),
                b.TotalAmount,
                b.CreatedOnUtc,
                "buyout"
            ));
        }

        return result.OrderByDescending(x => x.CreatedOnUtc).ToList();
    }

    private async Task<List<CustomerRentalOrderWithListing>> AttachMedicalReferencesAsync(List<CustomerRentalOrderWithListing> items, CancellationToken cancellationToken)
    {
        var orderIds = items.Select(x => x.Order.Id).ToList();
        var refs = await customerDb.CustomerOrderDoctorReferences.Where(r => orderIds.Contains(r.CustomerRentalOrderId) && !r.IsDeleted).ToListAsync(cancellationToken);

        var doctorIds = refs.Select(r => r.DoctorId).Distinct().ToList();
        var doctors = doctorIds.Count > 0
            ? await commonDb.Doctors.Where(d => doctorIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id, cancellationToken)
            : new();

        return items.Select(item =>
        {
            var r = refs.FirstOrDefault(x => x.CustomerRentalOrderId == item.Order.Id);
            var doctor = r != null ? doctors.GetValueOrDefault(r.DoctorId) : null;

            if (r != null) item.Order.DoctorReference = r;

            return item with { Doctor = doctor };
        }).ToList();
    }

    private async Task<CustomerRentalOrderWithListing?> AttachMedicalReferenceAsync(CustomerRentalOrderWithListing? item, CancellationToken cancellationToken)
    {
        if (item is null) return null;
        var list = await AttachMedicalReferencesAsync(new List<CustomerRentalOrderWithListing> { item }, cancellationToken);
        return list.FirstOrDefault();
    }

    /// <summary>
    /// Chemicals are priced per packaging size (variants). Prefer active variant buy prices;
    /// fall back to product-level BuyPrice for equipment.
    /// </summary>
    private static (decimal? MinBuyPrice, decimal? MaxBuyPrice) ResolveCatalogBuyPrices(Product? product)
    {
        if (product is null) return (null, null);

        var activeVariantPrices = product.Variants?
            .Where(v => v.IsActive && v.BuyPrice > 0)
            .Select(v => v.BuyPrice)
            .ToList() ?? [];

        if (activeVariantPrices.Count > 0)
        {
            var min = activeVariantPrices.Min();
            var max = activeVariantPrices.Max();
            return (min, max > min ? max : null);
        }

        return (product.BuyPrice, null);
    }

    /// <summary>
    /// Customer-facing stock for one catalog product: every public vendor listing.
    /// Chemicals are grouped by packaging size (ProductVariantId).
    /// </summary>
    private async Task<(int ProductTotal, List<VariantInventoryItem> VariantTotals)> LoadMarketplaceAvailabilityAsync(
        Guid productId,
        bool isChemical,
        CancellationToken cancellationToken)
    {
        var listings = await vendorDb.VendorProductListings
            .AsNoTracking()
            .Include(x => x.Inventory)
            .Where(x =>
                x.ProductId == productId &&
                !x.IsDeleted &&
                !x.Vendor.IsDeleted &&
                (EF.Functions.ILike(x.ListingStatus, "active") || EF.Functions.ILike(x.ListingStatus, "approved")) &&
                EF.Functions.ILike(x.Vendor.AccountStatus, "active"))
            .ToListAsync(cancellationToken);

        if (listings.Count == 0)
            return (0, []);

        if (isChemical)
        {
            var listingIds = listings.Select(l => l.Id).ToList();
            var variantRows = await vendorDb.VendorVariantInventories
                .AsNoTracking()
                .Where(vi => listingIds.Contains(vi.VendorProductListingId))
                .Select(vi => new { vi.ProductVariantId, vi.AvailableQuantity })
                .ToListAsync(cancellationToken);

            var byVariant = CatalogListingAvailability.SumByVariantId(
                variantRows.Select(v => (v.ProductVariantId, v.AvailableQuantity)));
            var variantTotals = byVariant
                .Select(kv => new VariantInventoryItem(kv.Key, kv.Value))
                .ToList();
            var productTotal = variantTotals.Count > 0
                ? CatalogListingAvailability.SumAvailable(variantTotals.Select(v => v.AvailableQuantity))
                : CatalogListingAvailability.SumAvailable(
                    listings.Select(l => l.Inventory?.AvailableQuantity ?? l.AvailableQuantity));
            return (productTotal, variantTotals);
        }

        var equipmentTotal = CatalogListingAvailability.SumAvailable(
            listings.Select(l => l.Inventory?.AvailableQuantity ?? l.AvailableQuantity));
        return (equipmentTotal, []);
    }

    private async Task<Dictionary<Guid, int>> GetVariantAvailableSumsAsync(
        IReadOnlyCollection<Guid> listingIds,
        CancellationToken cancellationToken)
    {
        if (listingIds.Count == 0)
        {
            return [];
        }

        return await vendorDb.VendorVariantInventories
            .AsNoTracking()
            .Where(vi => listingIds.Contains(vi.VendorProductListingId))
            .GroupBy(vi => vi.VendorProductListingId)
            .Select(g => new { ListingId = g.Key, Available = g.Sum(x => x.AvailableQuantity) })
            .ToDictionaryAsync(x => x.ListingId, x => x.Available, cancellationToken);
    }

    private static int ResolvePublicAvailableQuantity(
        VendorProductListing listing,
        Product? product,
        IReadOnlyDictionary<Guid, int> variantAvailableSums)
    {
        var isChemical = product?.Category?.IsChemical == true || product?.ChemicalProperty != null;
        int? variantSum = variantAvailableSums.TryGetValue(listing.Id, out var sum) ? sum : null;
        var listingLevel = listing.Inventory?.AvailableQuantity ?? listing.AvailableQuantity;
        return CatalogListingAvailability.ResolveAvailableQuantity(isChemical, listingLevel, variantSum);
    }
}




