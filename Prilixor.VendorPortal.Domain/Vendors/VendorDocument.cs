using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorDocument : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
    public string VerificationStatus { get; set; } = "pending";
    public string? RejectionReason { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
}
