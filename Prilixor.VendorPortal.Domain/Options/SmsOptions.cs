namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>Selects which SMS/OTP provider implementation to register.</summary>
public sealed class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>SMS provider. ShreeSMS is the only implementation.</summary>
    public string Provider { get; set; } = "ShreeSms";
}
