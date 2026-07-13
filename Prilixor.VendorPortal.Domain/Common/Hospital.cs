using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Common;

public class Hospital : AuditableEntity<Guid>, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    
    // Auto-approval means this will default to true, or we don't even need the flag. 
    // We'll keep it true by default to indicate it's active and usable.
    public bool IsVerified { get; set; } = true;
    
    public ICollection<HospitalDoctor> Doctors { get; set; } = [];
    
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
