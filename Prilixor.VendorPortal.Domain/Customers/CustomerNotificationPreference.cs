using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerNotificationPreference : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerId { get; set; }
    public bool OrderStatusUpdatesEnabled { get; set; } = true;
    public bool ExpirationRemindersEnabled { get; set; } = true;
    public bool DepositRefundsEnabled { get; set; } = true;
    public bool DirectMessagesEnabled { get; set; } = true;
    public bool MarketingEmailsEnabled { get; set; } = false;
    public bool SmsNotificationsEnabled { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
}
