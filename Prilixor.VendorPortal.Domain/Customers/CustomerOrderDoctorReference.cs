using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerOrderDoctorReference : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid DoctorId { get; set; }

    public CustomerRentalOrder Order { get; set; } = null!;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
