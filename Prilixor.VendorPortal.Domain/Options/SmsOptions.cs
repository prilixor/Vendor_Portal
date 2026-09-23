namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>Selects which SMS/OTP provider implementation to register.</summary>
public sealed class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>"Twilio" (default) or "2Factor".</summary>
    public string Provider { get; set; } = "Twilio";
}
