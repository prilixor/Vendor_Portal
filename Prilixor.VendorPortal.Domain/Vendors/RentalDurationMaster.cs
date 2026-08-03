using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Global Admin-managed rental duration template (label + days).
/// Product pricing applies a daily rate + discount against these templates.
/// </summary>
public class RentalDurationMaster : AuditableEntity<Guid>, ISoftDelete
{
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
