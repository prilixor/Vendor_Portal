namespace Prilixor.VendorPortal.Domain.Options;

public sealed class ShreeSmsOptions
{
    public const string SectionName = "ShreeSms";

    /// <summary>Master switch. When false, OTP falls back to Dev OTP in Development.</summary>
    public bool Enabled { get; set; }

    /// <summary>ShreeSMS APIkey. Never commit a real value.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>DLT-approved header, 6 characters (e.g. BLNKSM).</summary>
    public string SenderId { get; set; } = string.Empty;

    /// <summary>DLT Principal Entity ID.</summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>DLT template id for the approved login OTP text.</summary>
    public string OtpTemplateId { get; set; } = string.Empty;

    /// <summary>ShreeSMS panel: 4 = OTP Transactional.</summary>
    public int OtpSmsType { get; set; } = 4;

    public string BaseUrl { get; set; } = "https://web.shreesms.net/API/SendSMS.aspx";

    public int OtpResendCooldownSeconds { get; set; } = 45;

    /// <summary>Accepted in Development when ShreeSMS is not configured. Never use in Production.</summary>
    public string DevFallbackOtp { get; set; } = "000000";

    /// <summary>Order and account SMS stay off until those DLT templates are approved.</summary>
    public bool TransactionalSmsEnabled { get; set; }
}
