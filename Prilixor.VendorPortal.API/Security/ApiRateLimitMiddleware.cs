using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Prilixor.VendorPortal.Application.Security;

namespace Prilixor.VendorPortal.API.Security;

/// <summary>
/// Blocks repeated calls to the same API by the signed-in user, and repeated login or OTP calls by mobile number or IP.
/// </summary>
public sealed class ApiRateLimitMiddleware(RequestDelegate next, ApiRateLimitGate gate, ILogger<ApiRateLimitMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var now = DateTimeOffset.UtcNow;
        var kind = AuthEndpointRateRules.Classify(context.Request.Path.Value);
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        if (kind != AuthLimitKind.None && HttpMethods.IsPost(context.Request.Method))
        {
            var subject = await ReadSubjectAsync(context, context.RequestAborted);
            if (await RejectAuthAsync(context, kind, subject, ip, now))
                return;

            context.Items["rate-limit-kind"] = kind;
            context.Items["rate-limit-subject"] = subject;
            context.Items["rate-limit-ip"] = ip;
            if (kind == AuthLimitKind.OtpSend)
                context.Items["rate-limit-otp-reserved"] = true;
        }
        else if (IsSignedInWrite(context, out var userId, out var endpointKey))
        {
            var key = $"write:{userId}:{endpointKey}";
            if (!gate.TryConsume(key, AuthEndpointRateRules.SignedInWritesPerMinute, AuthEndpointRateRules.SignedInWriteWindow, now, out var retryAfter))
            {
                logger.LogWarning("Signed-in write limit hit for user {UserId} on {Endpoint}", userId, endpointKey);
                await WriteTooManyAsync(context, "Too many requests. Please wait a minute and try again.", retryAfter, context.RequestAborted);
                return;
            }
        }

        var otpSendFailed = false;
        try
        {
            await next(context);
        }
        catch
        {
            otpSendFailed = true;
            throw;
        }
        finally
        {
            var sent = !otpSendFailed && context.Response.StatusCode is >= 200 and < 300;
            if (kind == AuthLimitKind.OtpSend && context.Items["rate-limit-otp-reserved"] is true && !sent)
                RefundOtpSend(context, now);
        }

        if (kind is AuthLimitKind.OtpVerify or AuthLimitKind.PasswordLogin)
            RecordAuthResult(context, kind, now);
    }

    private void RefundOtpSend(HttpContext context, DateTimeOffset now)
    {
        var subject = context.Items["rate-limit-subject"] as string;
        var ip = context.Items["rate-limit-ip"] as string ?? "unknown";
        if (subject is not null)
            gate.Refund($"otp-send:phone:{subject}", now);
        gate.Refund($"otp-send:ip:{ip}", now);
    }

    private async Task<bool> RejectAuthAsync(HttpContext context, AuthLimitKind kind, string? subject, string ip, DateTimeOffset now)
    {
        switch (kind)
        {
            case AuthLimitKind.OtpSend:
                var phoneReserved = false;
                if (subject is not null && !gate.TryConsume($"otp-send:phone:{subject}", AuthEndpointRateRules.OtpSendsPerPhone, AuthEndpointRateRules.OtpSendWindow, now, out var phoneRetry))
                {
                    logger.LogWarning("OTP send limit hit for a mobile number from {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many verification codes were requested for this mobile number. Please wait 10 minutes and try again.", phoneRetry, context.RequestAborted);
                    return true;
                }

                phoneReserved = subject is not null;
                if (!gate.TryConsume($"otp-send:ip:{ip}", AuthEndpointRateRules.OtpSendsPerIp, AuthEndpointRateRules.OtpSendWindow, now, out var ipRetry))
                {
                    if (phoneReserved)
                        gate.Refund($"otp-send:phone:{subject!}", now);
                    logger.LogWarning("OTP send limit hit for IP {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many verification codes were requested from this network. Please wait 10 minutes and try again.", ipRetry, context.RequestAborted);
                    return true;
                }

                return false;

            case AuthLimitKind.OtpVerify:
                if (subject is not null && gate.IsLocked($"otp-fail:phone:{subject}", now, out var verifyRetry))
                {
                    logger.LogWarning("OTP verify lock hit for a mobile number from {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many incorrect codes. Please wait 15 minutes and try again.", verifyRetry, context.RequestAborted);
                    return true;
                }

                if (gate.IsLocked($"otp-fail:ip:{ip}", now, out var verifyIpRetry))
                {
                    logger.LogWarning("OTP verify lock hit for IP {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many incorrect codes from this network. Please wait 15 minutes and try again.", verifyIpRetry, context.RequestAborted);
                    return true;
                }

                return false;

            case AuthLimitKind.PasswordLogin:
                if (subject is not null && gate.IsLocked($"login-fail:id:{subject}", now, out var loginRetry))
                {
                    logger.LogWarning("Password sign-in lock hit for an account from {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many sign-in attempts. Please wait 15 minutes and try again.", loginRetry, context.RequestAborted);
                    return true;
                }

                if (gate.IsLocked($"login-fail:ip:{ip}", now, out var loginIpRetry))
                {
                    logger.LogWarning("Password sign-in lock hit for IP {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many sign-in attempts from this network. Please wait 15 minutes and try again.", loginIpRetry, context.RequestAborted);
                    return true;
                }

                return false;

            case AuthLimitKind.AccountRecovery:
                if (subject is not null && !gate.TryConsume($"recover:id:{subject}", AuthEndpointRateRules.RecoveryAttempts, AuthEndpointRateRules.RecoveryWindow, now, out var recoverRetry))
                {
                    logger.LogWarning("Account recovery limit hit for an account from {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many password reset attempts. Please wait 10 minutes and try again.", recoverRetry, context.RequestAborted);
                    return true;
                }

                if (!gate.TryConsume($"recover:ip:{ip}", AuthEndpointRateRules.RecoveryAttemptsPerIp, AuthEndpointRateRules.RecoveryWindow, now, out var recoverIpRetry))
                {
                    logger.LogWarning("Account recovery limit hit for IP {Ip}", ip);
                    await WriteTooManyAsync(context, "Too many password reset attempts from this network. Please wait 10 minutes and try again.", recoverIpRetry, context.RequestAborted);
                    return true;
                }

                return false;

            default:
                return false;
        }
    }

    private void RecordAuthResult(HttpContext context, AuthLimitKind kind, DateTimeOffset now)
    {
        var status = context.Response.StatusCode;
        var subject = context.Items["rate-limit-subject"] as string;
        var ip = context.Items["rate-limit-ip"] as string ?? "unknown";
        var succeeded = status is >= 200 and < 300;
        var failed = status is >= 400 and < 500;

        if (kind == AuthLimitKind.OtpVerify)
        {
            if (succeeded)
            {
                if (subject is not null) gate.Clear($"otp-fail:phone:{subject}");
                return;
            }

            if (!failed) return;
            if (subject is not null)
                gate.RecordFailure($"otp-fail:phone:{subject}", AuthEndpointRateRules.OtpVerifyFailures, AuthEndpointRateRules.OtpVerifyLock, now);
            gate.RecordFailure($"otp-fail:ip:{ip}", AuthEndpointRateRules.OtpVerifyFailuresPerIp, AuthEndpointRateRules.OtpVerifyLock, now);
            return;
        }

        if (succeeded)
        {
            if (subject is not null) gate.Clear($"login-fail:id:{subject}");
            return;
        }

        if (!failed) return;
        if (subject is not null)
            gate.RecordFailure($"login-fail:id:{subject}", AuthEndpointRateRules.LoginFailures, AuthEndpointRateRules.LoginLock, now);
        gate.RecordFailure($"login-fail:ip:{ip}", AuthEndpointRateRules.LoginFailuresPerIp, AuthEndpointRateRules.LoginLock, now);
    }

    private static bool IsSignedInWrite(HttpContext context, out string userId, out string endpointKey)
    {
        userId = "";
        endpointKey = "";
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        var method = context.Request.Method;
        if (!HttpMethods.IsPost(method) && !HttpMethods.IsPut(method) && !HttpMethods.IsPatch(method) && !HttpMethods.IsDelete(method))
            return false;

        var path = AuthEndpointRateRules.Normalize(context.Request.Path.Value);
        if (path is "/auth/refresh" or "/auth/logout")
            return false;
        if (AuthEndpointRateRules.Classify(path) != AuthLimitKind.None)
            return false;

        var pattern = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;
        endpointKey = $"{method.ToUpperInvariant()}:{(string.IsNullOrWhiteSpace(pattern) ? path : pattern)}";
        if (endpointKey.Contains("/quote", StringComparison.OrdinalIgnoreCase))
            return false;

        userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        return userId.Length > 0;
    }

    private static async Task<string?> ReadSubjectAsync(HttpContext context, CancellationToken cancellationToken)
    {
        if (context.Request.ContentLength is > 16_384)
            return null;

        context.Request.EnableBuffering();
        string body;
        using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true))
        {
            body = await reader.ReadToEndAsync(cancellationToken);
        }

        context.Request.Body.Position = 0;
        if (string.IsNullOrWhiteSpace(body))
            return null;

        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return null;

            if (TryGetString(root, "phone", out var phone))
                return Digits(phone);
            if (TryGetString(root, "email", out var email))
                return NormalizeAccount(email);
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static bool TryGetString(JsonElement root, string name, out string value)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (!property.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                continue;
            if (property.Value.ValueKind == JsonValueKind.String)
            {
                value = property.Value.GetString() ?? "";
                return value.Trim().Length > 0;
            }
        }

        value = "";
        return false;
    }

    private static string? Digits(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length == 0)
            return null;
        return digits.Length > 10 ? digits[^10..] : digits;
    }

    private static string? NormalizeAccount(string email)
    {
        var trimmed = email.Trim();
        if (trimmed.Length == 0)
            return null;
        if (trimmed.Any(char.IsLetter) || trimmed.Contains('@'))
            return trimmed.ToLowerInvariant();
        return Digits(trimmed);
    }

    private static Task WriteTooManyAsync(HttpContext context, string detail, TimeSpan retryAfter, CancellationToken cancellationToken)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/problem+json";
        context.Response.Headers.RetryAfter = seconds.ToString();
        var json = JsonSerializer.Serialize(new
        {
            title = "auth.rate_limited",
            detail,
            status = StatusCodes.Status429TooManyRequests,
        });
        return context.Response.WriteAsync(json, cancellationToken);
    }
}
