namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record SmsSendResult(bool Success, string? ProviderMessageSid, string? Error);

/// <summary>
/// Outbound SMS payload. <see cref="Body"/> is used on upgraded accounts;
/// <see cref="TrialTemplateKey"/> is used when Twilio trial template mode is enabled.
/// </summary>
public sealed record SmsMessage(string Body, string TrialTemplateKey);

public interface ISmsService
{
    bool IsEnabled { get; }

    Task<SmsSendResult> SendAsync(string e164Phone, SmsMessage message, CancellationToken ct = default);
}
