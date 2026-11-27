namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// Why a customer order ended as "cancelled". Stored on the order together with who did it
/// (<see cref="CancellationActors"/>: customer, admin or system), so every screen can show a clear reason.
/// </summary>
public static class OrderCancelReasons
{
    /// <summary>The customer cancelled the request.</summary>
    public const string CustomerRequest = "customer_request";

    /// <summary>An admin cancelled the order.</summary>
    public const string AdminCancelled = "admin_cancelled";

    /// <summary>The system cancelled an unpaid order because payment was not completed in time.</summary>
    public const string PaymentNotCompleted = "payment_not_completed";

    /// <summary>The system cancelled the order because payment could not be started.</summary>
    public const string CheckoutFailed = "checkout_failed";

    /// <summary>One clear sentence for every screen (web and apps). Null when the reason is unknown (old orders).</summary>
    public static string? Label(string? reason) => reason?.Trim().ToLowerInvariant() switch
    {
        CustomerRequest => "Cancelled by the customer.",
        AdminCancelled => "Cancelled by BlinksMed admin.",
        PaymentNotCompleted => "Cancelled automatically: payment was not completed in time.",
        CheckoutFailed => "Cancelled automatically: payment could not be started.",
        _ => null,
    };

    /// <summary>Reasons that are not a real order problem: nothing was paid, so no one needs to act.</summary>
    public static bool IsUnpaidAbandonment(string? reason) =>
        string.Equals(reason, PaymentNotCompleted, StringComparison.OrdinalIgnoreCase)
        || string.Equals(reason, CheckoutFailed, StringComparison.OrdinalIgnoreCase);
}
