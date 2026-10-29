using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// DLT-approved ShreeSMS OTP bodies. The live MsgText must match the sentence
/// for that flow, with only the variable replaced by the 6-digit code.
/// </summary>
public static class ShreeSmsOtpTemplate
{
    public const string LoginBody =
        "Your BlinksMed login OTP is {#var#}. Do not share this code with anyone. Valid for 10 minutes. - BlinksMed";

    /// <summary>DLT name: Number Update. Used for every phone-ownership check.</summary>
    public const string PhoneVerificationBody =
        "Your OTP to verify your mobile number on BlinksMed is {#numeric#}. Do not share this code with anyone. Valid for 10 minutes. - BlinksMed";

    /// <summary>DLT name: Password Reset OTP. Wording must match the approved template.</summary>
    public const string PasswordResetBody =
        "Your BlinksMed password reset OTP is {#numeric#}. Do not share this code with anyone. Valid for 10 minutes. - BlinksMed";

    public static string WithCode(PhoneOtpPurpose purpose, string code)
    {
        var body = purpose switch
        {
            PhoneOtpPurpose.PhoneVerification => PhoneVerificationBody,
            PhoneOtpPurpose.PasswordReset => PasswordResetBody,
            _ => LoginBody
        };

        return body
            .Replace("{#var#}", code, StringComparison.Ordinal)
            .Replace("{#numeric#}", code, StringComparison.Ordinal);
    }
}
