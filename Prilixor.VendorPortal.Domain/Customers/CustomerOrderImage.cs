using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>Customer-uploaded photo attached to a rental/purchase order for the fulfilling vendor.</summary>
public class CustomerOrderImage : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid VendorId { get; set; }
    /// <summary>Durable storage key (S3 relative key or local uploads/… path). Never a short-lived presigned URL.</summary>
    public string StoredReference { get; set; } = string.Empty;
    public string? OriginalFileName { get; set; }
    public string? ContentType { get; set; }
    public int SortOrder { get; set; }

    public CustomerRentalOrder Order { get; set; } = null!;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
