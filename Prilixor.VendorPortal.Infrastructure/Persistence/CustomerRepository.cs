using Microsoft.EntityFrameworkCore;

using Prilixor.VendorPortal.Application.Abstractions;

using Prilixor.VendorPortal.Domain.Customers;

using Prilixor.VendorPortal.Domain.Vendors;

using Prilixor.Shared.Abstractions.DI;



namespace Prilixor.VendorPortal.Infrastructure.Persistence;



public sealed class CustomerRepository(
    ApplicationDbContext vendorDb,
    CustomerPortalDbContext customerDb,
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

        CancellationToken cancellationToken)

    {

        var q = vendorDb.VendorProductListings

            .AsNoTracking()

            .Include(l => l.Vendor)

            .ThenInclude(v => v.Profile)

            .Include(l => l.Product)

            .ThenInclude(p => p.Category)

            .Include(l => l.Images)

            .Where(l =>

                !l.IsDeleted &&

                (EF.Functions.ILike(l.ListingStatus, "active") ||

                 EF.Functions.ILike(l.ListingStatus, "approved")) &&

                !l.Vendor.IsDeleted &&

                EF.Functions.ILike(l.Vendor.AccountStatus, "active"));



        if (!string.IsNullOrWhiteSpace(categoryFilter))

        {

            var cf = categoryFilter.Trim();

            q = q.Where(l => l.Product.Category != null &&

                             EF.Functions.ILike(l.Product.Category.CategoryName, cf));

        }



        if (!string.IsNullOrWhiteSpace(search))

        {

            var s = search.Trim();

            q = q.Where(l =>

                EF.Functions.ILike(l.ListingTitle, $"%{s}%") ||

                (l.Vendor.Profile != null && EF.Functions.ILike(l.Vendor.Profile.BusinessName, $"%{s}%")) ||

                EF.Functions.ILike(l.Product.ProductName, $"%{s}%"));

        }



        var rows = await q

            .OrderByDescending(l => l.CreatedOnUtc)

            .Take(500)

            .ToListAsync(cancellationToken);



        return rows.Select(l =>

        {

            var cat = l.Product.Category;

            var vendorName = l.Vendor.Profile?.BusinessName;

            if (string.IsNullOrWhiteSpace(vendorName))

                vendorName = l.Vendor.Email;

            var area = l.Vendor.Profile?.City is { Length: > 0 } c ? $"{c} region" : "Service area on request";

            var primaryUrl = ResolvePrimaryListingImageUrl(l.Images);

            return new CustomerCatalogListingDto(

                l.Id,

                l.ListingTitle,

                vendorName ?? "Vendor",

                4.8m,

                area,

                cat?.CategoryName ?? "General",

                l.DailyRent,

                l.MonthlyRent,

                l.SecurityDeposit,

                cat?.PrescriptionRequired ?? false,

                cat?.DepositRequired ?? false,

                l.ListingStatus,

                primaryUrl);

        }).ToList();

    }



    public async Task<VendorProductListingAggregate?> GetListingForCustomerAsync(Guid listingId, CancellationToken cancellationToken)

    {

        var l = await vendorDb.VendorProductListings

            .Include(x => x.Vendor).ThenInclude(v => v.Profile)

            .Include(x => x.Product).ThenInclude(p => p.Category)

            .Include(x => x.Images)

            .Include(x => x.Inventory)

            .FirstOrDefaultAsync(x => x.Id == listingId && !x.IsDeleted, cancellationToken);



        if (l is null) return null;



        var inv = l.Inventory;

        var imgs = ResolveOrderedDistinctListingImageUrls(l.Images);

        var desc = string.IsNullOrWhiteSpace(l.Product.LongDescription)

            ? l.Product.ShortDescription ?? string.Empty

            : l.Product.LongDescription!;

        return new VendorProductListingAggregate

        {

            ListingId = l.Id,

            VendorId = l.VendorId,

            VendorAccountStatus = l.Vendor.AccountStatus,

            VendorBusinessName = string.IsNullOrWhiteSpace(l.Vendor.Profile?.BusinessName)

                ? l.Vendor.Email

                : l.Vendor.Profile!.BusinessName,

            ListingTitle = l.ListingTitle,

            ListingStatus = l.ListingStatus,

            DailyRent = l.DailyRent,

            MonthlyRent = l.MonthlyRent,

            SecurityDeposit = l.SecurityDeposit,

            ListingAvailableQuantity = l.AvailableQuantity,

            CategoryPrescriptionRequired = l.Product.Category?.PrescriptionRequired ?? false,

            CategoryDepositRequired = l.Product.Category?.DepositRequired ?? false,

            CategoryName = l.Product.Category?.CategoryName ?? "General",

            Description = desc,

            ImageUrls = imgs,

            InventoryId = inv?.Id,

            InventoryAvailable = inv?.AvailableQuantity ?? l.AvailableQuantity,

            InventoryReserved = inv?.ReservedQuantity ?? 0,

            InventoryTotal = inv?.TotalQuantity ?? l.AvailableQuantity,

            InventoryRented = inv?.RentedQuantity ?? 0,

            InventoryBlocked = inv?.BlockedQuantity ?? 0,

        };

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



    public Task UpdateCustomerRentalOrderAsync(CustomerRentalOrder order, CancellationToken cancellationToken)

    {

        customerDb.CustomerRentalOrders.Update(order);

        return Task.CompletedTask;

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



    private string? ResolvePrimaryListingImageUrl(IEnumerable<VendorProductImage> images) =>

        ResolveOrderedDistinctListingImageUrls(images).FirstOrDefault();

}


