using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerOrderVendorOffer : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }
    public Guid VendorId { get; set; }
    public Guid VendorProductListingId { get; set; }
    public int OfferRank { get; set; }
    public string Status { get; set; } = "pending"; // pending, accepted, rejected, expired
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RespondedAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public CustomerRentalOrder CustomerRentalOrder { get; set; } = null!;
}
