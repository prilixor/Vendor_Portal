using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorProductDocument : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorProductListingId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = "pending";
    public string? RejectionReason { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public VendorProductListing VendorProductListing { get; set; } = null!;
}
