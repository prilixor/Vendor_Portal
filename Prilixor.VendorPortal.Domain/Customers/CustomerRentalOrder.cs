using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

public class CustomerRentalOrder : AuditableEntity<Guid>, ISoftDelete
{
    public string OrderNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Guid VendorProductListingId { get; set; }
    public Guid? CustomerAddressId { get; set; }
    public int Quantity { get; set; }
    public int RentalDays { get; set; }
    public string OrderType { get; set; } = "rent";
    public string DeliveryOption { get; set; } = "standard";
    public string Status { get; set; } = "pending";
    public decimal SubtotalAmount { get; set; }
    public decimal DepositAmount { get; set; }
    public decimal ServiceFeeAmount { get; set; }
    public decimal DistanceFeeAmount { get; set; }
    public decimal ExpressFeeAmount { get; set; }
    public decimal GstAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
    /// <summary>Listing rows live in the vendor database; use <see cref="VendorProductListingId"/> when querying the vendor DbContext.</summary>
    public CustomerAddress? CustomerAddress { get; set; }
}
