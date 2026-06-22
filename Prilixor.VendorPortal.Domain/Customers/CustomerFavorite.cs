using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Domain.Customers;

public sealed class CustomerFavorite
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VendorProductListingId { get; set; }
    public DateTimeOffset AddedAtUtc { get; set; }

    public Customer Customer { get; set; } = null!;
    public VendorProductListing VendorProductListing { get; set; } = null!;
}
