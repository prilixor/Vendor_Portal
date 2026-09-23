using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

/// <summary>
/// 2Factor OTP. Prefer transactional template SMS (TSMS) when configured — AUTOGEN often
/// falls back to Voice on Personal accounts when the template lives under Transactional SMS.
/// </summary>
public sealed class TwoFactorPhoneVerificationService(
    IHttpClientFactory httpClientFactory,
    IOptions<TwoFactorOptions> options,
    IHostEnvironment environment,
    ILogger<TwoFactorPhoneVerificationService> logger) : IPhoneVerificationService
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastSendUtc = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, string> SessionsByPhone = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, LocalOtpEntry> LocalOtps = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, DevOtpEntry> DevOtps = new(StringComparer.Ordinal);

    private readonly TwoFactorOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    private bool UseTransactionalOtp =>
        _options.UseTransactionalTemplateForOtp
        && !string.IsNullOrWhiteSpace(_options.OtpTemplateName)
        && !string.IsNullOrWhiteSpace(_options.SenderId);

    public async Task<PhoneOtpSendResult> SendOtpAsync(string e164Phone, CancellationToken ct = default)
    {
        if (!TryAcquireSendSlot(e164Phone, out var waitSeconds))
        {
            var message = waitSeconds == 1
                ? "You can request a new code in 1 second."
                : $"You can request a new code in {waitSeconds} seconds.";
            return new PhoneOtpSendResult(false, message, "phone.otp_rate_limited");
        }

        if (!IsEnabled)
        {
            if (!environment.IsDevelopment())
            {
                return new PhoneOtpSendResult(false, "Phone verification is not configured.", "phone.verify_unavailable");
            }

            var code = string.IsNullOrWhiteSpace(_options.DevFallbackOtp) ? "000000" : _options.DevFallbackOtp.Trim();
            DevOtps[e164Phone] = new DevOtpEntry(code, DateTimeOffset.UtcNow.AddMinutes(10));
            logger.LogWarning("DEV phone OTP for {Phone}: {Code}", e164Phone, code);
            return new PhoneOtpSendResult(true, "Verification code sent (development mode).");
        }

        try
        {
            if (UseTransactionalOtp)
            {
                return await SendTransactionalTemplateOtpAsync(e164Phone, ct);
            }

            return await SendAutogenOtpAsync(e164Phone, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "2Factor OTP send failed for {Phone}", e164Phone);
            LastSendUtc.TryRemove(e164Phone, out _);
            return new PhoneOtpSendResult(false, "Failed to send verification code.", "phone.otp_send_failed");
        }
    }

    public async Task<PhoneOtpVerifyResult> VerifyOtpAsync(string e164Phone, string code, CancellationToken ct = default)
    {
        var trimmed = (code ?? string.Empty).Trim();
        if (trimmed.Length < 4 || trimmed.Length > 10)
        {
            return new PhoneOtpVerifyResult(false, "Enter a valid verification code.", "phone.invalid_code");
        }

        if (!IsEnabled)
        {
            if (!environment.IsDevelopment())
            {
                return new PhoneOtpVerifyResult(false, "Phone verification is not configured.", "phone.verify_unavailable");
            }

            if (DevOtps.TryGetValue(e164Phone, out var entry)
                && entry.ExpiresAtUtc > DateTimeOffset.UtcNow
                && string.Equals(entry.Code, trimmed, StringComparison.Ordinal))
            {
                DevOtps.TryRemove(e164Phone, out _);
                return new PhoneOtpVerifyResult(true, "Phone verified.");
            }

            if (string.Equals((_options.DevFallbackOtp ?? string.Empty).Trim(), trimmed, StringComparison.Ordinal))
            {
                return new PhoneOtpVerifyResult(true, "Phone verified.");
            }

            return new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code");
        }

        // Transactional-template OTP is verified locally (we generated the code).
        if (LocalOtps.TryGetValue(e164Phone, out var local)
            && local.ExpiresAtUtc > DateTimeOffset.UtcNow
            && string.Equals(local.Code, trimmed, StringComparison.Ordinal))
        {
            LocalOtps.TryRemove(e164Phone, out _);
            SessionsByPhone.TryRemove(e164Phone, out _);
            return new PhoneOtpVerifyResult(true, "Phone verified.");
        }

        if (!SessionsByPhone.TryGetValue(e164Phone, out var sessionId) || string.IsNullOrWhiteSpace(sessionId))
        {
            return new PhoneOtpVerifyResult(false, "Request a new verification code.", "phone.invalid_code");
        }

        // Skip remote VERIFY for local-only session markers.
        if (sessionId.StartsWith("local:", StringComparison.Ordinal))
        {
            return new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code");
        }

        try
        {
            var client = httpClientFactory.CreateClient("TwoFactor");
            var url =
                $"{TrimBase(_options.BaseUrl)}/{Uri.EscapeDataString(_options.ApiKey.Trim())}/SMS/VERIFY/{Uri.EscapeDataString(sessionId)}/{Uri.EscapeDataString(trimmed)}";

            using var response = await client.GetAsync(url, ct);
            var payload = await response.Content.ReadFromJsonAsync<TwoFactorApiResponse>(cancellationToken: ct);

            if (payload is not null
                && string.Equals(payload.Status, "Success", StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrWhiteSpace(payload.Details)
                    || payload.Details.Contains("Matched", StringComparison.OrdinalIgnoreCase)
                    || payload.Details.Contains("Success", StringComparison.OrdinalIgnoreCase)))
            {
                SessionsByPhone.TryRemove(e164Phone, out _);
                return new PhoneOtpVerifyResult(true, "Phone verified.");
            }

            logger.LogWarning(
                "2Factor OTP verify rejected. Phone={Phone} BodyStatus={BodyStatus} Details={Details}",
                e164Phone,
                payload?.Status,
                payload?.Details);
            return new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "2Factor OTP verify failed for {Phone}", e164Phone);
            return new PhoneOtpVerifyResult(false, "Failed to verify code.", "phone.otp_verify_failed");
        }
    }

    private async Task<PhoneOtpSendResult> SendTransactionalTemplateOtpAsync(string e164Phone, CancellationToken ct)
    {
        var otp = GenerateNumericOtp(6);
        var phone = ToTwoFactorPhone(e164Phone);
        var client = httpClientFactory.CreateClient("TwoFactor");
        var apiKey = Uri.EscapeDataString(_options.ApiKey.Trim());
        var url = $"{TrimBase(_options.BaseUrl)}/{apiKey}/ADDON_SERVICES/SEND/TSMS";

        var form = new Dictionary<string, string>
        {
            ["From"] = _options.SenderId.Trim(),
            ["To"] = phone,
            ["TemplateName"] = _options.OtpTemplateName.Trim(),
            ["VAR1"] = otp
        };

        logger.LogInformation(
            "2Factor OTP via transactional SMS. Phone={Phone} Template={Template} SenderId={SenderId}",
            e164Phone,
            _options.OtpTemplateName.Trim(),
            _options.SenderId.Trim());

        using var content = new FormUrlEncodedContent(form);
        using var response = await client.PostAsync(url, content, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        TwoFactorApiResponse? payload = null;
        try
        {
            payload = JsonSerializer.Deserialize<TwoFactorApiResponse>(raw);
        }
        catch
        {
            // ignore
        }

        if (payload is null || !string.Equals(payload.Status, "Success", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError(
                "2Factor transactional OTP failed. Phone={Phone} Http={Status} Body={Body}",
                e164Phone,
                (int)response.StatusCode,
                Truncate(raw, 500));
            LastSendUtc.TryRemove(e164Phone, out _);
            return new PhoneOtpSendResult(false, "Failed to send verification code.", "phone.otp_send_failed");
        }

        LocalOtps[e164Phone] = new LocalOtpEntry(otp, DateTimeOffset.UtcNow.AddMinutes(10));
        SessionsByPhone[e164Phone] = "local:" + (payload.Details ?? Guid.NewGuid().ToString("N"));

        // Success from 2Factor means accepted — not always delivered. Log OTP in Development
        // so local testing can continue when Personal accounts fall back to Voice / drop SMS.
        if (environment.IsDevelopment())
        {
            logger.LogWarning(
                "2Factor transactional OTP accepted (DeliveryId={Details}). DEV OTP for {Phone}: {Code}",
                payload.Details,
                e164Phone,
                otp);
        }
        else
        {
            logger.LogInformation(
                "2Factor transactional OTP accepted. Phone={Phone} DeliveryId={Details}",
                e164Phone,
                payload.Details);
        }

        return new PhoneOtpSendResult(true, "Verification code sent.");
    }

    private async Task<PhoneOtpSendResult> SendAutogenOtpAsync(string e164Phone, CancellationToken ct)
    {
        var phone = ToTwoFactorPhone(e164Phone);
        var client = httpClientFactory.CreateClient("TwoFactor");
        var apiKey = Uri.EscapeDataString(_options.ApiKey.Trim());
        var phoneEscaped = Uri.EscapeDataString(phone);
        var url = $"{TrimBase(_options.BaseUrl)}/{apiKey}/SMS/{phoneEscaped}/AUTOGEN";
        if (!string.IsNullOrWhiteSpace(_options.OtpTemplateName))
        {
            url += $"/{Uri.EscapeDataString(_options.OtpTemplateName.Trim())}";
        }

        logger.LogInformation(
            "2Factor OTP via AUTOGEN. Phone={Phone} Template={Template}",
            e164Phone,
            string.IsNullOrWhiteSpace(_options.OtpTemplateName) ? "(default)" : _options.OtpTemplateName.Trim());

        using var response = await client.GetAsync(url, ct);
        var payload = await response.Content.ReadFromJsonAsync<TwoFactorApiResponse>(cancellationToken: ct);

        if (payload is null || !string.Equals(payload.Status, "Success", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(payload.Details))
        {
            logger.LogError(
                "2Factor AUTOGEN OTP failed. Phone={Phone} Http={Status} BodyStatus={BodyStatus} Details={Details}",
                e164Phone,
                (int)response.StatusCode,
                payload?.Status,
                payload?.Details);
            LastSendUtc.TryRemove(e164Phone, out _);
            return new PhoneOtpSendResult(false, "Failed to send verification code.", "phone.otp_send_failed");
        }

        SessionsByPhone[e164Phone] = payload.Details.Trim();
        return new PhoneOtpSendResult(true, "Verification code sent.");
    }

    private static string GenerateNumericOtp(int length)
    {
        Span<byte> bytes = stackalloc byte[length];
        RandomNumberGenerator.Fill(bytes);
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = (char)('0' + (bytes[i] % 10));
        }

        return new string(chars);
    }

    private bool TryAcquireSendSlot(string e164Phone, out int waitSeconds)
    {
        var cooldown = Math.Max(15, _options.OtpResendCooldownSeconds);
        var now = DateTimeOffset.UtcNow;
        if (LastSendUtc.TryGetValue(e164Phone, out var last))
        {
            var elapsed = now - last;
            if (elapsed.TotalSeconds < cooldown)
            {
                waitSeconds = (int)Math.Ceiling(cooldown - elapsed.TotalSeconds);
                return false;
            }
        }

        LastSendUtc[e164Phone] = now;
        waitSeconds = 0;
        return true;
    }

    /// <summary>2Factor expects digits with country code, e.g. 91XXXXXXXXXX (no +).</summary>
    internal static string ToTwoFactorPhone(string e164Phone)
    {
        var digits = new string((e164Phone ?? string.Empty).Where(char.IsDigit).ToArray());
        // Normalize 10-digit Indian mobiles to 91XXXXXXXXXX.
        if (digits.Length == 10 && digits[0] is >= '6' and <= '9')
        {
            digits = "91" + digits;
        }

        return digits;
    }

    private static string TrimBase(string baseUrl) => (baseUrl ?? string.Empty).TrimEnd('/');

    private static string Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max] + "…";

    private sealed record DevOtpEntry(string Code, DateTimeOffset ExpiresAtUtc);
    private sealed record LocalOtpEntry(string Code, DateTimeOffset ExpiresAtUtc);

    private sealed class TwoFactorApiResponse
    {
        [JsonPropertyName("Status")]
        public string? Status { get; set; }

        [JsonPropertyName("Details")]
        public string? Details { get; set; }
    }
}
