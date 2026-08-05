using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

/// <summary>
/// Global Admin-managed billing-cycle duration template (label + days + cycles).
/// Product pricing applies a daily rate + discount against these templates.
/// Icons/badges are assigned per product plan, not on the master.
/// </summary>
public class RentalDurationMaster : AuditableEntity<Guid>, ISoftDelete
{
    /// <summary>Customer-facing name, e.g. "1 Billing Cycle" or "1.5 Billing Cycles".</summary>
    public string DurationLabel { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    /// <summary>Display billing-cycle count (e.g. 0.5, 1, 1.5, 2, 3).</summary>
    public decimal BillingCycles { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
