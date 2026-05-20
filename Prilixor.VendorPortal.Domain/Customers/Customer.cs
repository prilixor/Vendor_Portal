using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class Customer : AuditableEntity<Guid>, ISoftDelete
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsEmailVerified { get; set; } = true;
    public DateTimeOffset? LastLoginAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<CustomerAddress> Addresses { get; set; } = [];
    public ICollection<CustomerRentalOrder> Orders { get; set; } = [];
    public ICollection<CustomerNotification> Notifications { get; set; } = [];
}
