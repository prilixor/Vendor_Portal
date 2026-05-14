using System;
using Prilixor.Shared.Abstractions.DB;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Domain.Support;

public class SupportTicket : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public string TicketNumber { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = "Open";
    
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor? Vendor { get; set; }
    public ICollection<SupportMessage> Messages { get; set; } = [];
}
