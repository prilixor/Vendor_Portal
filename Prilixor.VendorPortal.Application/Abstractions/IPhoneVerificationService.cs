namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record PhoneOtpSendResult(bool Success, string Message, string? ErrorCode = null);

public sealed record PhoneOtpVerifyResult(bool Success, string Message, string? ErrorCode = null);

public interface IPhoneVerificationService
{
    bool IsEnabled { get; }

    Task<PhoneOtpSendResult> SendOtpAsync(string e164Phone, CancellationToken ct = default);

    Task<PhoneOtpVerifyResult> VerifyOtpAsync(string e164Phone, string code, CancellationToken ct = default);
}
