using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// One Razorpay payment covering one or more draft rental orders (whole-cart checkout).
/// </summary>
public class CustomerCheckoutSession : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerId { get; set; }
    /// <summary>customer_web | admin_payment_link</summary>
    public string Source { get; set; } = CheckoutSessionSources.CustomerWeb;
    /// <summary>created | paid | failed | expired | cancelled</summary>
    public string Status { get; set; } = CheckoutSessionStatuses.Created;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public string? RazorpayPaymentLinkId { get; set; }
    public string? PaymentLinkUrl { get; set; }
    public string? Receipt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public Guid? PlacedByAdminId { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Customer Customer { get; set; } = null!;
    public ICollection<CustomerCheckoutSessionOrder> SessionOrders { get; set; } = [];
}

public class CustomerCheckoutSessionOrder
{
    public Guid CheckoutSessionId { get; set; }
    public Guid CustomerRentalOrderId { get; set; }

    public CustomerCheckoutSession CheckoutSession { get; set; } = null!;
    public CustomerRentalOrder CustomerRentalOrder { get; set; } = null!;
}

public static class CheckoutSessionSources
{
    public const string CustomerWeb = "customer_web";
    public const string AdminPaymentLink = "admin_payment_link";
}

public static class CheckoutSessionStatuses
{
    public const string Created = "created";
    public const string Paid = "paid";
    public const string Failed = "failed";
    public const string Expired = "expired";
    public const string Cancelled = "cancelled";
}
