using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorInventory : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorProductListingId { get; set; }
    public int TotalQuantity { get; set; }
    public int AvailableQuantity { get; set; }
    public int ReservedQuantity { get; set; }
    public int RentedQuantity { get; set; }
    public int BlockedQuantity { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public VendorProductListing VendorProductListing { get; set; } = null!;
    public ICollection<VendorInventoryMovement> Movements { get; set; } = [];
}
