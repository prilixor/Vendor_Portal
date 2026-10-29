using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Auth;

internal static class PhoneOtpDisabled
{
    public const string Code = "phone.otp_disabled";
    public const string Message = "Phone OTP is turned off. Sign in with your email or mobile number and password.";

    public static Result<T> Fail<T>() =>
        Result.Failure<T>(new Error(Code, Message, ErrorCategory.Validation));
}
