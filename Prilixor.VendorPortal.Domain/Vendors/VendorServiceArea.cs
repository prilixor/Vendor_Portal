using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorServiceArea : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public decimal CenterLatitude { get; set; }
    public decimal CenterLongitude { get; set; }
    public decimal ServiceRadiusKm { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
}
