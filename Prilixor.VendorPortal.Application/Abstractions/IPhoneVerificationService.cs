namespace Prilixor.VendorPortal.Application.Abstractions;

public sealed record PhoneOtpSendResult(bool Success, string Message, string? ErrorCode = null);

public sealed record PhoneOtpVerifyResult(bool Success, string Message, string? ErrorCode = null);

/// <summary>Which approved DLT sentence to send. The code is still checked the same way.</summary>
public enum PhoneOtpPurpose
{
    Login,
    PhoneVerification,
    PasswordReset
}

public interface IPhoneVerificationService
{
    bool IsEnabled { get; }

    Task<PhoneOtpSendResult> SendOtpAsync(string e164Phone, PhoneOtpPurpose purpose, CancellationToken ct = default);

    Task<PhoneOtpVerifyResult> VerifyOtpAsync(string e164Phone, string code, CancellationToken ct = default);
}
