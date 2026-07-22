using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Common;

public class Doctor : AuditableEntity<Guid>, ISoftDelete
{
    public string FullName { get; set; } = string.Empty;
    /// <summary>Shareable code e.g. DRAP2601.</summary>
    public string UniqueCode { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Specialization { get; set; }
    public string? ContactNumber { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
