using Microsoft.EntityFrameworkCore;

using Prilixor.VendorPortal.Application.Abstractions;

using Prilixor.VendorPortal.Domain.Customers;

using Prilixor.VendorPortal.Domain.Vendors;

using Prilixor.Shared.Abstractions.DI;



namespace Prilixor.VendorPortal.Infrastructure.Persistence;



public sealed class CustomerRepository(
    ApplicationDbContext vendorDb,
    CustomerPortalDbContext customerDb,
    CommonPortalDbContext commonDb,
    IVendorFileUrlResolver fileUrlResolver)
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
            .Where(p => !p.IsDeleted && p.IsActive);

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
            .OrderByDescending(r => r.CreatedOnUtc)
            .Take(500)
            .ToList();

        var productAvailability = filteredRows
            .GroupBy(r => r.ProductId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(x => Math.Max(0, x.Inventory?.AvailableQuantity ?? x.AvailableQuantity)));


        var listingDtos = filteredRows.Select(l =>

        {

            var cat = productMap.GetValueOrDefault(l.ProductId)?.Category;

            var vendorName = l.Vendor.Profile?.BusinessName;

            if (string.IsNullOrWhiteSpace(vendorName))

                vendorName = l.Vendor.Email;

            var area = l.Vendor.Profile?.City is { Length: > 0 } c ? $"{c} region" : "Service area on request";

            var productPrimaryUrl = ResolvePrimaryProductImageUrl(productMap.GetValueOrDefault(l.ProductId)?.ProductImages ?? []);
            var primaryUrl = ResolvePrimaryListingImageUrl(l.Images) ?? productPrimaryUrl;
            var availableQuantity = Math.Max(0, l.Inventory?.AvailableQuantity ?? l.AvailableQuantity);
            var productTotalAvailableQuantity = productAvailability.GetValueOrDefault(l.ProductId, availableQuantity);
            var availabilityStatus = availableQuantity <= 0
                ? "out_of_stock"
                : (availableQuantity <= 3 ? "low_stock" : "available");

            return new CustomerCatalogListingDto(

                l.Id,

                l.ListingTitle,

                vendorName ?? "Vendor",

                4.8m,

                area,

                cat?.CategoryName ?? "General",

                productMap.GetValueOrDefault(l.ProductId)?.DailyRent ?? l.DailyRent,

                productMap.GetValueOrDefault(l.ProductId)?.MonthlyRent ?? l.MonthlyRent,

                productMap.GetValueOrDefault(l.ProductId)?.SecurityDeposit ?? l.SecurityDeposit,

                cat?.PrescriptionRequired ?? false,

                cat?.DepositRequired ?? false,

                l.ListingStatus,

                availableQuantity,

                productTotalAvailableQuantity,

                availabilityStatus,

                primaryUrl);

        }).ToList();

        var listedProductIds = filteredRows
            .Select(x => x.ProductId)
            .ToHashSet();

        var placeholders = products
            .Where(p => !listedProductIds.Contains(p.Id))
            .Select(p => new CustomerCatalogListingDto(
                p.Id,
                p.ProductName,
                "No vendor assigned",
                0m,
                "Vendor assignment pending",
                p.Category?.CategoryName ?? "General",
                p.DailyRent,
                p.MonthlyRent,
                p.SecurityDeposit,
                p.Category?.PrescriptionRequired ?? false,
                p.Category?.DepositRequired ?? false,
                "product_only",
                0,
                0,
                "out_of_stock",
                ResolvePrimaryProductImageUrl(p.ProductImages)))
            .ToList();

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
            .Concat(placeholders)
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
            .FirstOrDefaultAsync(p => p.Id == l.ProductId && !p.IsDeleted, cancellationToken);
        if (product is null)
        {
            return null;
        }

        return ToAggregate(l, product);
    }

    public async Task<List<VendorProductListingAggregate>> GetCandidateListingsByProductIdAsync(Guid productId, CancellationToken cancellationToken)
    {
        var product = await commonDb.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.ProductImages)
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

        return listings.Select(l => ToAggregate(l, product)).ToList();
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

        return orders.ConvertAll(o =>

        {

            var listing = map.GetValueOrDefault(o.VendorProductListingId);

            var img = ResolvePrimaryListingImageUrl(listing?.Images ?? []);

            return new CustomerRentalOrderWithListing(o, listing, img);

        });

    }



    public async Task<CustomerRentalOrderWithListing?> GetCustomerOrderAsync(Guid customerId, Guid orderId, CancellationToken cancellationToken)

    {

        var order = await customerDb.CustomerRentalOrders

            .FirstOrDefaultAsync(o => o.Id == orderId && o.CustomerId == customerId && !o.IsDeleted, cancellationToken);

        if (order is null) return null;



        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);

        var img = ResolvePrimaryListingImageUrl(listing?.Images ?? []);

        return new CustomerRentalOrderWithListing(order, listing, img);

    }



    public async Task<CustomerRentalOrderWithListing?> GetCustomerOrderByNumberAsync(Guid customerId, string orderNumber, CancellationToken cancellationToken)

    {

        var n = orderNumber.Trim();

        var order = await customerDb.CustomerRentalOrders

            .FirstOrDefaultAsync(o => o.CustomerId == customerId && o.OrderNumber == n && !o.IsDeleted, cancellationToken);

        if (order is null) return null;



        var listing = await LoadListingWithVendorAsync(order.VendorProductListingId, cancellationToken);

        var img = ResolvePrimaryListingImageUrl(listing?.Images ?? []);

        return new CustomerRentalOrderWithListing(order, listing, img);

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
        var img = ResolvePrimaryListingImageUrl(listing?.Images ?? []);
        return new CustomerRentalOrderWithListing(order, listing, img);
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

    public Task<List<CustomerOrderVendorOffer>> GetPendingVendorOffersAsync(Guid vendorId, CancellationToken cancellationToken) =>
        customerDb.CustomerOrderVendorOffers
            .Where(x => x.VendorId == vendorId && x.Status == "pending" && !x.IsDeleted)
            .OrderByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

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
                (o.Status == "confirmed" || o.Status == "active" || o.Status == "in_transit"))
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
                (o.Status == "confirmed" || o.Status == "active" || o.Status == "in_transit"))
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
                (o.Status == "confirmed" || o.Status == "active" || o.Status == "in_transit"))
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
            .Where(x => listingIds.Contains(x.Id) && !x.IsDeleted)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

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
                order.EndDate.Value));
        }

        return result;
    }



    private VendorProductListingAggregate ToAggregate(VendorProductListing listing, Product product)
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
            ListingTitle = listing.ListingTitle,
            ListingStatus = listing.ListingStatus,
            DailyRent = product.DailyRent,
            MonthlyRent = product.MonthlyRent,
            SecurityDeposit = product.SecurityDeposit,
            BuyPrice = product.BuyPrice,
            GstPercent = product.GstPercent,
            IsRentEnabled = product.IsRentEnabled,
            IsBuyEnabled = product.IsBuyEnabled,
            ListingAvailableQuantity = listing.AvailableQuantity,
            CategoryPrescriptionRequired = product.Category?.PrescriptionRequired ?? false,
            CategoryDepositRequired = product.Category?.DepositRequired ?? false,
            CategoryName = product.Category?.CategoryName ?? "General",
            Description = desc,
            ImageUrls = imgs,
            InventoryId = inv?.Id,
            InventoryAvailable = inv?.AvailableQuantity ?? listing.AvailableQuantity,
            InventoryReserved = inv?.ReservedQuantity ?? 0,
            InventoryTotal = inv?.TotalQuantity ?? listing.AvailableQuantity,
            InventoryRented = inv?.RentedQuantity ?? 0,
            InventoryBlocked = inv?.BlockedQuantity ?? 0,
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



    private string? ResolvePrimaryListingImageUrl(IEnumerable<VendorProductImage> images) =>

        ResolveOrderedDistinctListingImageUrls(images).FirstOrDefault();

    private string? ResolvePrimaryProductImageUrl(IEnumerable<ProductImage> images) =>
        ResolveOrderedDistinctProductImageUrls(images).FirstOrDefault();

}


