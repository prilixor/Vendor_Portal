using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorProductAsset : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorProductListingId { get; set; }
    
    /// <summary>
    /// The unique identifier or serial number for this specific physical item.
    /// </summary>
    public string AssetTag { get; set; } = string.Empty;
    
    /// <summary>
    /// Examples: "Available", "Rented", "Lost", "InRepair"
    /// </summary>
    public string Status { get; set; } = "Available";
    
    /// <summary>
    /// Examples: "Good", "Damaged", "New"
    /// </summary>
    public string? Condition { get; set; } = "Good";

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public VendorProductListing VendorProductListing { get; set; } = null!;
}
