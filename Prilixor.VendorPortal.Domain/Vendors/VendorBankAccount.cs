using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class VendorBankAccount : AuditableEntity<Guid>, ISoftDelete
{
    public Guid VendorId { get; set; }
    public string AccountHolderName { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public string IfscCode { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = "pending";
    public DateTimeOffset? VerifiedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Vendor Vendor { get; set; } = null!;
}
