namespace Prilixor.VendorPortal.Application.Security;

public enum AuthLimitKind
{
    None = 0,
    OtpSend,
    OtpVerify,
    PasswordLogin,
    AccountRecovery,
}

/// <summary>
/// Which anonymous auth calls are limited by mobile number, account, or IP.
/// </summary>
public static class AuthEndpointRateRules
{
    public const int OtpSendsPerPhone = 5;
    public static readonly TimeSpan OtpSendWindow = TimeSpan.FromMinutes(10);
    /// <summary>
    /// Successful texts only. High enough for an office or hospital on one public IP.
    /// One mobile number is still capped by <see cref="OtpSendsPerPhone"/>.
    /// </summary>
    public const int OtpSendsPerIp = 200;

    public const int OtpVerifyFailures = 5;
    public static readonly TimeSpan OtpVerifyLock = TimeSpan.FromMinutes(15);
    public const int OtpVerifyFailuresPerIp = 10;

    public const int LoginFailures = 10;
    public static readonly TimeSpan LoginLock = TimeSpan.FromMinutes(15);
    public const int LoginFailuresPerIp = 20;

    public const int RecoveryAttempts = 5;
    public static readonly TimeSpan RecoveryWindow = TimeSpan.FromMinutes(10);
    public const int RecoveryAttemptsPerIp = 10;

    public const int SignedInWritesPerMinute = 10;
    public static readonly TimeSpan SignedInWriteWindow = TimeSpan.FromMinutes(1);

    public static AuthLimitKind Classify(string? path)
    {
        var normalized = Normalize(path);
        return normalized switch
        {
            "/auth/login/sms/send-otp" or "/auth/phone/send-otp" or "/auth/forgot-password/sms/send-otp" => AuthLimitKind.OtpSend,
            "/auth/login/sms/verify-otp" or "/auth/phone/verify-otp" or "/auth/forgot-password/sms/verify-otp" => AuthLimitKind.OtpVerify,
            "/auth/login" => AuthLimitKind.PasswordLogin,
            "/auth/forgot-password" or "/auth/forgot-password/sms/reset" => AuthLimitKind.AccountRecovery,
            _ => AuthLimitKind.None,
        };
    }

    public static string Normalize(string? path)
    {
        var value = (path ?? string.Empty).Trim();
        if (value.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            value = value[4..];
        else if (string.Equals(value, "/api", StringComparison.OrdinalIgnoreCase))
            value = "/";

        value = value.TrimEnd('/');
        if (value.Length == 0)
            return "/";
        if (!value.StartsWith('/'))
            value = "/" + value;
        return value.ToLowerInvariant();
    }
}
