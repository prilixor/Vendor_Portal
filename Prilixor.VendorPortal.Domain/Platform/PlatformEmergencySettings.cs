using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Platform;

/// <summary>
/// Single-row admin switch for equipment emergencies.
/// Admin is always alerted. The vendor bell is used only when <see cref="AlertVendorEnabled"/> is true.
/// </summary>
public class PlatformEmergencySettings : AuditableEntity<Guid>, ISoftDelete
{
    public bool AlertVendorEnabled { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
