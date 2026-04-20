using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class Product : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CategoryId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public string? ShortDescription { get; set; }
    public string? LongDescription { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ProductCategory Category { get; set; } = null!;
    public ICollection<VendorProductListing> VendorProductListings { get; set; } = [];
}
