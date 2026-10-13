using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;
using Prilixor.VendorPortal.Application.Services;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

/// <summary>
/// ShreeSMS OTP. The gateway only delivers SMS, so the code is generated and checked here.
/// MsgText is the approved DLT template with the code in place of {#var#}.
/// </summary>
public sealed class ShreeSmsPhoneVerificationService(
    IHttpClientFactory httpClientFactory,
    IOptions<ShreeSmsOptions> options,
    IHostEnvironment environment,
    ILogger<ShreeSmsPhoneVerificationService> logger) : IPhoneVerificationService
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastSendUtc = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, LocalOtpEntry> LocalOtps = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, DevOtpEntry> DevOtps = new(StringComparer.Ordinal);

    private readonly ShreeSmsOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.ApiKey)
        && !string.IsNullOrWhiteSpace(_options.SenderId)
        && !string.IsNullOrWhiteSpace(_options.EntityId)
        && !string.IsNullOrWhiteSpace(_options.OtpTemplateId);

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
            logger.LogWarning(
                "ShreeSMS OTP not configured (need ApiKey, SenderId, EntityId, OtpTemplateId). DEV OTP for {Phone}: {Code}",
                e164Phone,
                code);
            return new PhoneOtpSendResult(true, "Verification code sent (development mode).");
        }

        if (!IndianMobilePhone.TryNormalize(e164Phone, out var mobile))
        {
            LastSendUtc.TryRemove(e164Phone, out _);
            return new PhoneOtpSendResult(false, "Enter a valid mobile number.", "phone.invalid_phone");
        }

        var otp = GenerateNumericOtp(6);
        try
        {
            var client = httpClientFactory.CreateClient("ShreeSms");
            var url = QueryHelpers.AddQueryString(_options.BaseUrl.Trim(), new Dictionary<string, string?>
            {
                ["APIkey"] = _options.ApiKey.Trim(),
                ["SenderID"] = _options.SenderId.Trim(),
                ["SMSType"] = _options.OtpSmsType.ToString(),
                ["Mobile"] = mobile,
                ["MsgText"] = ShreeSmsOtpTemplate.WithCode(otp),
                ["EntityID"] = _options.EntityId.Trim(),
                ["TemplateID"] = _options.OtpTemplateId.Trim()
            });

            using var response = await client.PostAsync(url, new FormUrlEncodedContent([]), ct);
            var raw = (await response.Content.ReadAsStringAsync(ct)).Trim();

            if (!raw.StartsWith("ok|", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogError(
                    "ShreeSMS OTP failed. Phone={Phone} Http={Status} Body={Body}",
                    e164Phone,
                    (int)response.StatusCode,
                    Truncate(raw, 300));
                LastSendUtc.TryRemove(e164Phone, out _);
                return new PhoneOtpSendResult(false, "Failed to send verification code.", "phone.otp_send_failed");
            }

            LocalOtps[e164Phone] = new LocalOtpEntry(otp, DateTimeOffset.UtcNow.AddMinutes(10));
            var deliveryId = raw.Split('|').ElementAtOrDefault(2);
            logger.LogInformation(
                "ShreeSMS OTP accepted. Phone={Phone} DeliveryId={DeliveryId}",
                e164Phone,
                deliveryId);
            return new PhoneOtpSendResult(true, "Verification code sent.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ShreeSMS OTP send failed for {Phone}", e164Phone);
            LastSendUtc.TryRemove(e164Phone, out _);
            return new PhoneOtpSendResult(false, "Failed to send verification code.", "phone.otp_send_failed");
        }
    }

    public Task<PhoneOtpVerifyResult> VerifyOtpAsync(string e164Phone, string code, CancellationToken ct = default)
    {
        var trimmed = (code ?? string.Empty).Trim();
        if (trimmed.Length < 4 || trimmed.Length > 10)
        {
            return Task.FromResult(new PhoneOtpVerifyResult(false, "Enter a valid verification code.", "phone.invalid_code"));
        }

        if (!IsEnabled)
        {
            if (!environment.IsDevelopment())
            {
                return Task.FromResult(new PhoneOtpVerifyResult(false, "Phone verification is not configured.", "phone.verify_unavailable"));
            }

            if (DevOtps.TryGetValue(e164Phone, out var entry)
                && entry.ExpiresAtUtc > DateTimeOffset.UtcNow
                && string.Equals(entry.Code, trimmed, StringComparison.Ordinal))
            {
                DevOtps.TryRemove(e164Phone, out _);
                return Task.FromResult(new PhoneOtpVerifyResult(true, "Phone verified."));
            }

            if (string.Equals((_options.DevFallbackOtp ?? string.Empty).Trim(), trimmed, StringComparison.Ordinal))
            {
                return Task.FromResult(new PhoneOtpVerifyResult(true, "Phone verified."));
            }

            return Task.FromResult(new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code"));
        }

        if (LocalOtps.TryGetValue(e164Phone, out var local)
            && local.ExpiresAtUtc > DateTimeOffset.UtcNow
            && string.Equals(local.Code, trimmed, StringComparison.Ordinal))
        {
            LocalOtps.TryRemove(e164Phone, out _);
            return Task.FromResult(new PhoneOtpVerifyResult(true, "Phone verified."));
        }

        return Task.FromResult(new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code"));
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

    private static string Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max] + "…";

    private sealed record DevOtpEntry(string Code, DateTimeOffset ExpiresAtUtc);
    private sealed record LocalOtpEntry(string Code, DateTimeOffset ExpiresAtUtc);
}
