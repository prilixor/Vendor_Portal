using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Common;

public class Doctor : AuditableEntity<Guid>, ISoftDelete
{
    public string FullName { get; set; } = string.Empty;
    public string? Specialization { get; set; }
    public string? ContactNumber { get; set; }
    
    // Auto-approval means this will default to true
    public bool IsVerified { get; set; } = true;
    
    public ICollection<HospitalDoctor> Hospitals { get; set; } = [];
    
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
