using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>Customer-uploaded prescription image or PDF attached to an order.</summary>
public class CustomerOrderPrescriptionFile : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VendorId { get; set; }
    /// <summary>Durable storage key (S3 relative key or local uploads/… path).</summary>
    public string StoredReference { get; set; } = string.Empty;
    public string? OriginalFileName { get; set; }
    public string? ContentType { get; set; }
    public int SortOrder { get; set; }
    /// <summary>checkout | order_detail</summary>
    public string UploadSource { get; set; } = "checkout";

    public CustomerRentalOrder Order { get; set; } = null!;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
