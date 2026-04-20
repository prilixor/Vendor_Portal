using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorProductListing : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public Guid ProductId { get; set; }
    public string ListingTitle { get; set; } = string.Empty;
    public decimal DailyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public int AvailableQuantity { get; set; }
    public string ListingStatus { get; set; } = "draft";
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public ICollection<VendorProductImage> Images { get; set; } = [];
    public ICollection<VendorProductDocument> Documents { get; set; } = [];
    public VendorInventory? Inventory { get; set; }
}
