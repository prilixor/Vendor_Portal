using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Admin-configured day-based rental pricing plan for a product.
/// DiscountType: none | fixed | percentage.
/// </summary>
public class ProductRentalPricingPlan : AuditableEntity<Guid>
{
    public Guid ProductId { get; set; }
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
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

    public Product Product { get; set; } = null!;
}
