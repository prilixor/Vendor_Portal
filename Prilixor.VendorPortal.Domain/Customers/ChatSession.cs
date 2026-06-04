using Prilixor.Shared.Abstractions.DB;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Domain.Customers;

public class ChatSession : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerId { get; set; }
    public Guid VendorId { get; set; }
    public Guid? OrderId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public DateTimeOffset LastMessageAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsClosed { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
    public Vendor Vendor { get; set; } = null!;
    public CustomerRentalOrder? Order { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = [];
}
