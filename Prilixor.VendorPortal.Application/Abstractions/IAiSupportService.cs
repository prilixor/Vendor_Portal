namespace Prilixor.VendorPortal.Application.Abstractions;

/// <summary>Represents a response from the AI support service.</summary>
public sealed record AiResponse(
    string Message,
    bool CanAnswer);

public interface IAiSupportService
{
    /// <summary>
    /// Generates an AI response to a vendor's support message.
    /// </summary>
    /// <param name="vendorMessage">The vendor's current message.</param>
    /// <param name="category">The ticket category (if available).</param>
    /// <param name="subject">The ticket subject (if available).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <param name="conversationHistory">Previous messages in the conversation for context (sender type + message).</param>
    /// <returns>
    /// An AiResponse with CanAnswer=true if the AI can help, 
    /// or CanAnswer=false if the issue needs to be escalated to a human admin.
    /// </returns>
    Task<AiResponse> GenerateResponseAsync(
        string vendorMessage,
        string? category,
        string? subject,
        CancellationToken cancellationToken,
        List<(string SenderType, string Message)>? conversationHistory = null);
}
