namespace Prilixor.VendorPortal.Domain.Options;

public sealed class GeminiOptions
{
    public const string SectionName = "Gemini";

    /// <summary>Your Gemini API key from Google AI Studio.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>The Gemini API endpoint.</summary>
    public string ApiUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    /// <summary>System instructions for the AI support agent.</summary>
    public string SystemPrompt { get; set; } = 
        "You are a support assistant for the Prilixor Vendor Portal. " +
        "Vendors use this portal to register their rental equipment business, manage listings, inventory, and get orders. " +
        "You CAN: answer FAQs, guide vendors through troubleshooting, suggest solutions, categorize issues. " +
        "You CANNOT: approve or reject vendors, make critical decisions, replace human admin support. " +
        "If you cannot confidently answer, say 'I need to transfer this to our support team.' " +
        "Keep responses concise (2-3 sentences max). Be friendly and helpful.";
}