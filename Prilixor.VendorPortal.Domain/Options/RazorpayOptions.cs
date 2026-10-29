namespace Prilixor.VendorPortal.Domain.Options;

public sealed class RazorpayOptions
{
    public const string SectionName = "Razorpay";

    /// <summary>Key Id (rzp_test_… / rzp_live_…). Safe to expose to Checkout.js.</summary>
    public string KeyId { get; set; } = string.Empty;

    /// <summary>Key Secret — server only.</summary>
    public string KeySecret { get; set; } = string.Empty;

    /// <summary>Webhook signing secret from Razorpay Dashboard.</summary>
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>When false, checkout endpoints return a clear configuration error.</summary>
    public bool Enabled { get; set; } = true;
}
