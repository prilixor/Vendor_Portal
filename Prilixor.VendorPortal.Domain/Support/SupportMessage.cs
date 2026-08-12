using System;
using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Support;

public class SupportMessage : AuditableEntity<Guid>, ISoftDelete
{
    public Guid TicketId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderType { get; set; } = string.Empty; // "Vendor", "Admin", or "AI"
    public string Message { get; set; } = string.Empty;

    /// <summary>JSON array of attachment URLs (e.g., ["/uploads/file1.png", "/uploads/file2.pdf"]).</summary>
    public string? AttachmentUrls { get; set; }

    /// <summary>
    /// Admin inbox read state. Vendor messages and AI escalations start unread;
    /// cleared when an admin opens the ticket thread.
    /// </summary>
    public bool IsRead { get; set; } = true;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public SupportTicket? Ticket { get; set; }
}