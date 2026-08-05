using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Admin-managed icon for rental duration tiers.
/// ValueTier: good | better | best_value | maximum_savings
/// </summary>
public class RentalDurationIcon : AuditableEntity<Guid>, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    /// <summary>good | better | best_value | maximum_savings</summary>
    public string ValueTier { get; set; } = "good";
    public string ImageUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
