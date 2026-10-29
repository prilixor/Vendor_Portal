using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Admin-managed rental duration icon. Name is the customer label (Good, Premium, etc.).
/// ValueTier is a slug derived from the name.
/// </summary>
public class RentalDurationIcon : AuditableEntity<Guid>, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    /// <summary>Slug from the admin name (any value).</summary>
    public string ValueTier { get; set; } = "icon";
    public string ImageUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
