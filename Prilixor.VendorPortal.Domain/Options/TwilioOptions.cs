namespace Prilixor.VendorPortal.Domain.Options;

public sealed class TwilioOptions
{
    public const string SectionName = "Twilio";

    /// <summary>Master switch. When false, SMS/Verify no-op (dev uses in-memory OTP).</summary>
    public bool Enabled { get; set; }

    public string AccountSid { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>E.164 Twilio number or Messaging Service SID (MG...).</summary>
    public string FromNumberOrMessagingServiceSid { get; set; } = string.Empty;

    /// <summary>Twilio Verify Service SID (VA...).</summary>
    public string VerifyServiceSid { get; set; } = string.Empty;

    /// <summary>Minimum seconds between OTP sends to the same phone.</summary>
    public int OtpResendCooldownSeconds { get; set; } = 45;

    /// <summary>
    /// When Twilio is not configured, Development accepts this fixed OTP (never use in Production).
    /// </summary>
    public string DevFallbackOtp { get; set; } = "000000";

    /// <summary>
    /// Trial accounts reject custom SMS bodies. When true, send Twilio predefined template keys
    /// (e.g. sms_order_confirmation) instead of free-form text. Set false after upgrading.
    /// </summary>
    public bool UseTrialSmsTemplates { get; set; }

    /// <summary>Fallback trial template key when a message does not specify one.</summary>
    public string DefaultTrialSmsTemplate { get; set; } = "sms_account_alerts";
}
