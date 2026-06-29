using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerRentalOrderExtension : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    
    public DateOnly OriginalEndDate { get; set; }
    public DateOnly NewEndDate { get; set; }
    public int AdditionalDays { get; set; }
    
    public decimal ExtensionAmount { get; set; }
    public decimal ServiceFeeAmount { get; set; }
    public decimal GstAmount { get; set; }
    public decimal TotalAmount { get; set; }
    
    public string Status { get; set; } = "pending"; // pending, paid

    public CustomerRentalOrder CustomerRentalOrder { get; set; } = null!;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
