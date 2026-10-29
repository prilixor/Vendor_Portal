using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// One return inspection for one product line. Refund is this line's security deposit minus the vendor damage charge.
/// </summary>
public class CustomerOrderReturn : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }

    public decimal DepositAmount { get; set; }
    public decimal DamageAmount { get; set; }
    public string? DamageReason { get; set; }
    /// <summary>JSON array of up to 3 stored damage-photo references.</summary>
    public string? DamageImagePaths { get; set; }
    public decimal RefundAmount { get; set; }

    /// <summary>pending_refund | refunding | refunded | settled</summary>
    public string Status { get; set; } = OrderReturnStatuses.PendingRefund;

    /// <summary>razorpay | manual</summary>
    public string? RefundMethod { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public string? RazorpayRefundId { get; set; }
    public string? RefundReference { get; set; }
    public DateTimeOffset? RefundedAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public CustomerRentalOrder CustomerRentalOrder { get; set; } = null!;
}

public static class OrderReturnStatuses
{
    public const string PendingRefund = "pending_refund";
    public const string Refunding = "refunding";
    public const string Refunded = "refunded";
    public const string Settled = "settled";
}

public static class OrderRefundMethods
{
    public const string Razorpay = "razorpay";
    public const string Manual = "manual";
}
