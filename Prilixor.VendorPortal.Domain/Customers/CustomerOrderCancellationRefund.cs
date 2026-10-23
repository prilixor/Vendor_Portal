using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// One admin review for a paid product that was cancelled or could not be dispatched.
/// The customer refund is the captured payment minus an optional charge chosen by admin.
/// </summary>
public class CustomerOrderCancellationRefund : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CustomerRentalOrderId { get; set; }

    /// <summary>cancelled | dispatch_failed</summary>
    public string Outcome { get; set; } = CancellationOutcomes.Cancelled;

    /// <summary>customer | admin | vendor | system | unknown</summary>
    public string ActorRole { get; set; } = CancellationActors.Unknown;

    public string ActorLabel { get; set; } = string.Empty;

    public decimal PaidAmount { get; set; }
    public decimal OriginalPaidAmount { get; set; }
    public decimal ExtensionPaidAmount { get; set; }
    public decimal ChargeAmount { get; set; }
    public string? ChargeReason { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal RefundedOnlineAmount { get; set; }

    /// <summary>pending_review | refunding | refunded | settled</summary>
    public string Status { get; set; } = CancellationRefundStatuses.PendingReview;

    public bool HasOnlinePayment { get; set; }

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

public static class CancellationOutcomes
{
    public const string Cancelled = "cancelled";
    public const string DispatchFailed = "dispatch_failed";
}

public static class CancellationActors
{
    public const string Customer = "customer";
    public const string Admin = "admin";
    public const string Vendor = "vendor";
    public const string System = "system";
    public const string Unknown = "unknown";

    public static string Label(string role, string outcome, string? name)
    {
        var who = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        var failed = string.Equals(outcome, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase);
        if (failed)
        {
            if (string.Equals(role, Admin, StringComparison.OrdinalIgnoreCase))
                return who is null
                    ? "Admin marked this product dispatch failed."
                    : $"Admin {who} marked this product dispatch failed.";
            if (string.Equals(role, Vendor, StringComparison.OrdinalIgnoreCase))
                return "Dispatch failed after the vendor released this product.";
            return "Dispatch failed. No vendor could take this product.";
        }

        if (string.Equals(role, Customer, StringComparison.OrdinalIgnoreCase))
            return who is null
                ? "Cancelled by the customer."
                : $"Cancelled by the customer ({who}).";
        if (string.Equals(role, Admin, StringComparison.OrdinalIgnoreCase))
            return who is null
                ? "Cancelled by admin."
                : $"Cancelled by admin ({who}).";
        return "This product was cancelled. Confirm who cancelled it before refunding.";
    }
}

public static class CancellationRefundStatuses
{
    public const string PendingReview = "pending_review";
    public const string Refunding = "refunding";
    public const string Refunded = "refunded";
    public const string Settled = "settled";
}
