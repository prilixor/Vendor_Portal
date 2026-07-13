using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Tracks stock for a specific packaging size (variant/SKU) under a vendor's chemical listing.
/// One row per (listing, variant) pair.
/// </summary>
public class VendorVariantInventory : AuditableEntity<Guid>
{
    public Guid VendorProductListingId { get; set; }
    public Guid ProductVariantId { get; set; }

    /// <summary>Total units the vendor has declared they own for this SKU.</summary>
    public int TotalQuantity { get; set; }

    /// <summary>Units available for purchase (TotalQuantity minus reserved).</summary>
    public int AvailableQuantity { get; set; }

    /// <summary>Units held against pending/unconfirmed orders.</summary>
    public int ReservedQuantity { get; set; }

    // Navigation
    public VendorProductListing VendorProductListing { get; set; } = null!;
    public ProductVariant ProductVariant { get; set; } = null!;
}
