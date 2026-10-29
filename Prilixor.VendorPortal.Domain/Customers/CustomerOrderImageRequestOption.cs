using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>Labeled photo slot on a customer order image request (Option 1, Option 2, …).</summary>
public class CustomerOrderImageRequestOption : AuditableEntity<Guid>, ISoftDelete
{
    public Guid RequestId { get; set; }
    /// <summary>1-based slot number shown as "Option {n}".</summary>
    public int OptionNumber { get; set; }
    /// <summary>Optional vendor note under this option (max configured length).</summary>
    public string? Description { get; set; }

    public CustomerOrderImageRequest Request { get; set; } = null!;
    public ICollection<CustomerOrderImage> Images { get; set; } = [];

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
