using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorProductImage : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorProductListingId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; } = 1;
    public bool IsPrimary { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public VendorProductListing VendorProductListing { get; set; } = null!;
}
