using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerNotification : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string NotificationType { get; set; } = CustomerNotificationTypes.General;
    public Guid? RelatedOrderId { get; set; }
    public DateTimeOffset? ReadAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
}
