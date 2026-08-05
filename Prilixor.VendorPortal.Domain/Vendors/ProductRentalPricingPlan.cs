using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Admin-configured day-based rental pricing plan for a product.
/// DiscountType: none | fixed | percentage.
/// Icon/tier are per-product (same duration may use different icons on different products).
/// </summary>
public class ProductRentalPricingPlan : AuditableEntity<Guid>
{
    public Guid ProductId { get; set; }
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    /// <summary>Billing-cycle count snapshot for customer display.</summary>
    public decimal BillingCycles { get; set; }
    public decimal NormalPrice { get; set; }
    /// <summary>none | fixed | percentage</summary>
    public string DiscountType { get; set; } = "none";
    public decimal DiscountValue { get; set; }
    public decimal FinalRentalPrice { get; set; }
    public bool IsRecommended { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    /// <summary>Optional link to global duration template used when the plan was generated.</summary>
    public Guid? RentalDurationMasterId { get; set; }
    /// <summary>Per-product icon selection from rental_duration_icons.</summary>
    public Guid? RentalDurationIconId { get; set; }
    /// <summary>Snapshot of icon image URL at save time.</summary>
    public string? IconUrl { get; set; }
    public string? IconThumbnailUrl { get; set; }
    /// <summary>good | better | best_value | maximum_savings</summary>
    public string? ValueTier { get; set; }
    public string? IconName { get; set; }

    public Product Product { get; set; } = null!;
}
