using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class ProductCategory : AuditableEntity<Guid>, ISoftDelete
{
    public string CategoryName { get; set; } = string.Empty;
    public bool PrescriptionRequired { get; set; }
    public bool DepositRequired { get; set; }
    public bool InstallationRequired { get; set; }
    public bool IsChemical { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<Product> Products { get; set; } = [];
}
