using Prilixor.Shared.Abstractions.DB;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Domain.Customers;

public class ChatSession : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerId { get; set; }
    /// <summary>Order/vendor context. Null for admin chats not tied to a vendor.</summary>
    public Guid? VendorId { get; set; }
    public Guid? OrderId { get; set; }
    /// <summary>"Vendor" (legacy) or "Admin".</summary>
    public string CounterpartyType { get; set; } = ChatCounterpartyTypes.Admin;
    public string Subject { get; set; } = string.Empty;
    public DateTimeOffset LastMessageAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsClosed { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
    public Vendor? Vendor { get; set; }
    public CustomerRentalOrder? Order { get; set; }
    public ICollection<ChatMessage> Messages { get; set; } = [];
}

public static class ChatCounterpartyTypes
{
    public const string Vendor = "Vendor";
    public const string Admin = "Admin";
}
