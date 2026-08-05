using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class ChatMessage : AuditableEntity<Guid>, ISoftDelete
{
    public Guid ChatSessionId { get; set; }
    public string SenderType { get; set; } = string.Empty; // "Customer", "Vendor", or "Admin"
    public string MessageText { get; set; } = string.Empty;
    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsRead { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ChatSession ChatSession { get; set; } = null!;
}
