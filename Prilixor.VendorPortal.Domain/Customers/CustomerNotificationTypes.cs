namespace Prilixor.VendorPortal.Domain.Customers;

/// <summary>
/// Phase 1 in-app notification type identifiers for the customer portal (snake_case).
/// Persisted in <c>customer_notifications.notification_type</c>.
/// </summary>
public static class CustomerNotificationTypes
{
    /// <summary>Fallback / uncategorized.</summary>
    public const string General = "general";

    /// <summary>Sent after successful registration.</summary>
    public const string Welcome = "welcome";

    /// <summary>Order submitted; awaiting vendor.</summary>
    public const string OrderPending = "order_pending";

    /// <summary>Order cancelled (e.g. customer cancelled while pending).</summary>
    public const string OrderCancelled = "order_cancelled";

    /// <summary>Rental item will expire soon.</summary>
    public const string OrderExpiringSoon = "order_expiring_soon";

    /// <summary>BlinksMed support (admin) replied on an order chat.</summary>
    public const string SupportChatReply = "support_chat_reply";
}
