using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class AdminImpersonationExchange : AuditableEntity<Guid>
{
    public string CodeHash { get; set; } = string.Empty;
    public Guid AdminUserId { get; set; }
    /// <summary>vendor | customer</summary>
    public string TargetType { get; set; } = "vendor";
    public Guid? VendorId { get; set; }
    public Guid? CustomerId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public bool IsConsumed { get; set; }
}
