using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// System-defined customer request asking the fulfilling vendor to upload photos for an order.
/// Closed (and hidden) when the order is delivered, cancelled, or dispatch_failed.
/// </summary>
public class CustomerOrderImageRequest : AuditableEntity<Guid>, ISoftDelete
{
    public const string StatusOpen = "open";
    public const string StatusClosed = "closed";

    /// <summary>Fixed copy shown to customer and vendor (not free-form chat).</summary>
    public const string SystemRequestMessage =
        "Customer requested photos for this product. Please upload up to 5 photos so we can proceed.";

    public Guid CustomerRentalOrderId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VendorId { get; set; }
    /// <summary>open | closed</summary>
    public string Status { get; set; } = StatusOpen;
    public string Message { get; set; } = SystemRequestMessage;
    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ClosedAt { get; set; }
    /// <summary>delivered | cancelled | dispatch_failed</summary>
    public string? ClosedReason { get; set; }

    public CustomerRentalOrder Order { get; set; } = null!;
    public ICollection<CustomerOrderImage> Images { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
