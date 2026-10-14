using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Optional prices for one vendor listing. When <see cref="IsCustomPricing"/> is false,
/// checkout and browse keep using the catalog product price.
/// </summary>
public class VendorListingPriceOverride : AuditableEntity<Guid>
{
    public Guid VendorProductListingId { get; set; }
    public bool IsCustomPricing { get; set; }
    public decimal? DailyRent { get; set; }
    public decimal? SecurityDeposit { get; set; }
    public decimal? BuyPrice { get; set; }
    public decimal? VendorDailyRent { get; set; }
    public decimal? VendorBuyPrice { get; set; }

    public VendorProductListing VendorProductListing { get; set; } = null!;
    public ICollection<VendorListingVariantPriceOverride> Variants { get; set; } = [];
}

public class VendorListingVariantPriceOverride : AuditableEntity<Guid>
{
    public Guid VendorListingPriceOverrideId { get; set; }
    public Guid ProductVariantId { get; set; }
    public decimal BuyPrice { get; set; }
    public decimal VendorPrice { get; set; }

    public VendorListingPriceOverride VendorListingPriceOverride { get; set; } = null!;
}
