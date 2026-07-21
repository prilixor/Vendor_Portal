using Prilixor.VendorPortal.Domain.Support;

namespace Prilixor.VendorPortal.Application.Support;

/// <summary>
/// Rules for when the AI assistant should auto-reply on a support ticket thread.
/// </summary>
internal static class SupportAiReplyPolicy
{
    public const string EscalationFallback = "Our support team will assist you shortly.";

    public static bool IsHumanEngaged(SupportTicket ticket, IReadOnlyList<SupportMessage> messages) =>
        string.Equals(ticket.Status, "In Progress", StringComparison.OrdinalIgnoreCase)
        || messages.Any(m => string.Equals(m.SenderType, "Admin", StringComparison.OrdinalIgnoreCase));

    public static bool IsEscalationText(string? message)
    {
        var normalized = message?.Trim().TrimEnd('.') ?? string.Empty;
        return string.Equals(normalized, EscalationFallback.TrimEnd('.'), StringComparison.OrdinalIgnoreCase);
    }

    public static bool HasEscalationReply(IReadOnlyList<SupportMessage> messages) =>
        messages.Any(m =>
            string.Equals(m.SenderType, "AI", StringComparison.OrdinalIgnoreCase)
            && IsEscalationText(m.Message));

    /// <summary>
    /// AI replies once per thread for escalation, and never after an admin joins.
    /// Helpful AI answers may continue until escalated or a human takes over.
    /// </summary>
    public static bool ShouldGenerateAiReply(SupportTicket ticket, IReadOnlyList<SupportMessage> messages) =>
        !IsHumanEngaged(ticket, messages) && !HasEscalationReply(messages);

    /// Vendor follow-ups on an existing human thread must not invoke AI at all.
    public static bool IsVendorHumanThread(SupportTicket ticket, IReadOnlyList<SupportMessage> messages) =>
        !ShouldGenerateAiReply(ticket, messages);
}
