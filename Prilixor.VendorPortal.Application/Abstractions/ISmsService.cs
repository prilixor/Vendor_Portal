namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record SmsSendResult(bool Success, string? ProviderMessageSid, string? Error);

/// <summary>Outbound SMS body.</summary>
public sealed record SmsMessage(string Body);

public interface ISmsService
{
    bool IsEnabled { get; }

    Task<SmsSendResult> SendAsync(string e164Phone, SmsMessage message, CancellationToken ct = default);
}
