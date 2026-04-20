using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorAvailabilityOverride : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public DateOnly OverrideDate { get; set; }
    public bool IsAvailable { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string? Reason { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
}
