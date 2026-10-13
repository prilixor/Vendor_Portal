namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// DLT-approved ShreeSMS OTP body. The live MsgText must match this sentence
/// with only {#var#} replaced by the 6-digit code.
/// </summary>
public static class ShreeSmsOtpTemplate
{
    public const string Body =
        "Your BlinksMed login OTP is {#var#}. Do not share this code with anyone. Valid for 10 minutes. - BlinksMed";

    public static string WithCode(string code) =>
        Body.Replace("{#var#}", code, StringComparison.Ordinal);
}
