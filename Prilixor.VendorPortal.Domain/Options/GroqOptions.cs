namespace Prilixor.VendorPortal.Domain.Options;

public sealed class GroqOptions
{
    public const string SectionName = "Groq";

    /// <summary>Your Groq API key from console.groq.com.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>The Groq API endpoint.</summary>
    public string ApiUrl { get; set; } = "https://api.groq.com/openai/v1/chat/completions";

    /// <summary>The model to use.</summary>
    public string Model { get; set; } = "llama-3.3-70b-versatile";

    /// <summary>System instructions for the AI support agent.</summary>
    public string SystemPrompt { get; set; } = 
        "You are a support assistant for the Prilixor Vendor Portal. " +
        "Vendors use this portal to register their rental equipment business, manage listings, inventory, and get orders. " +
        "You CAN: answer FAQs, guide vendors through troubleshooting, suggest solutions, categorize issues. " +
        "You CANNOT: approve or reject vendors, make critical decisions, replace human admin support. " +
        "If you cannot confidently answer, start your response with 'ESCALATE: ' followed by a brief reason. " +
        "Keep responses concise (2-3 sentences max). Be friendly and helpful. " +
        "IMPORTANT: Every response must be UNIQUE and directly address the vendor's specific question. " +
        "DO NOT repeat the same answer or greeting. Vary your responses naturally. " +
        "Before answering, carefully read what the vendor actually asked.";
}