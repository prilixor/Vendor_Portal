namespace Prilixor.VendorPortal.Domain.Options;

public sealed class TwoFactorOptions
{
    public const string SectionName = "TwoFactor";

    /// <summary>Master switch. When false, OTP falls back to Dev OTP in Development.</summary>
    public bool Enabled { get; set; }

    /// <summary>2Factor API key from dashboard (never commit real values).</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Optional DLT-approved sender / header (e.g. BLNKSM).</summary>
    public string SenderId { get; set; } = string.Empty;

    /// <summary>
    /// 2Factor OTP template name (e.g. SmsTemp1). Used with AUTOGEN or transactional OTP send.
    /// </summary>
    public string OtpTemplateName { get; set; } = string.Empty;

    /// <summary>
    /// When true, send OTP via transactional TSMS (TemplateName + VAR1) instead of AUTOGEN.
    /// Use this when the template was approved under Transactional SMS (not OTP Services),
    /// because AUTOGEN often falls back to Voice on Personal accounts.
    /// </summary>
    public bool UseTransactionalTemplateForOtp { get; set; } = true;

    public string BaseUrl { get; set; } = "https://2factor.in/API/V1";

    /// <summary>Minimum seconds between OTP sends to the same phone.</summary>
    public int OtpResendCooldownSeconds { get; set; } = 45;

    /// <summary>
    /// When 2Factor is not configured, Development accepts this fixed OTP (never use in Production).
    /// </summary>
    public string DevFallbackOtp { get; set; } = "000000";

    /// <summary>
    /// Personal/trial accounts often cannot send free-form transactional SMS without DLT.
    /// When false, transactional SMS is skipped with a log (OTP still works).
    /// </summary>
    public bool TransactionalSmsEnabled { get; set; }

    /// <summary>Optional template id map for transactional SMS after DLT approval.</summary>
    public Dictionary<string, string> Templates { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
