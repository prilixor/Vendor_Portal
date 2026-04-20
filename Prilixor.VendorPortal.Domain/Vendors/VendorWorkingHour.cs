using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorWorkingHour : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public short DayOfWeek { get; set; }
    public bool IsOpen { get; set; } = true;
    public TimeOnly? OpenTime { get; set; }
    public TimeOnly? CloseTime { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
}
