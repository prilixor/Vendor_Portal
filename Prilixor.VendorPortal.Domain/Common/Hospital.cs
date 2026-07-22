using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Common;

public class Hospital : AuditableEntity<Guid>, ISoftDelete
{
    public string Name { get; set; } = string.Empty;
    public string? AddressLine1 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? ContactNumber { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<HospitalDoctor> Doctors { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
