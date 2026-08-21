using System.Collections.Concurrent;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Twilio;
using Twilio.Rest.Verify.V2.Service;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class TwilioPhoneVerificationService(
    IOptions<TwilioOptions> options,
    IHostEnvironment environment,
    ILogger<TwilioPhoneVerificationService> logger) : IPhoneVerificationService
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> LastSendUtc = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, DevOtpEntry> DevOtps = new(StringComparer.Ordinal);

    private readonly TwilioOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.AccountSid)
        && !string.IsNullOrWhiteSpace(_options.AuthToken)
        && !string.IsNullOrWhiteSpace(_options.VerifyServiceSid);

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
            TwilioClient.Init(_options.AccountSid, _options.AuthToken);
            await VerificationResource.CreateAsync(
                to: e164Phone,
                channel: "sms",
                pathServiceSid: _options.VerifyServiceSid);

            return new PhoneOtpSendResult(true, "Verification code sent.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Twilio Verify send failed for {Phone}", e164Phone);
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

            // Also accept configured fallback when no send was tracked (e.g. process restart).
            if (string.Equals((_options.DevFallbackOtp ?? string.Empty).Trim(), trimmed, StringComparison.Ordinal))
            {
                return new PhoneOtpVerifyResult(true, "Phone verified.");
            }

            return new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code");
        }

        try
        {
            TwilioClient.Init(_options.AccountSid, _options.AuthToken);
            var check = await VerificationCheckResource.CreateAsync(
                to: e164Phone,
                code: trimmed,
                pathServiceSid: _options.VerifyServiceSid);

            if (string.Equals(check.Status, "approved", StringComparison.OrdinalIgnoreCase))
            {
                return new PhoneOtpVerifyResult(true, "Phone verified.");
            }

            return new PhoneOtpVerifyResult(false, "Invalid or expired verification code.", "phone.invalid_code");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Twilio Verify check failed for {Phone}", e164Phone);
            return new PhoneOtpVerifyResult(false, "Failed to verify code.", "phone.otp_verify_failed");
        }
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

    private sealed record DevOtpEntry(string Code, DateTimeOffset ExpiresAtUtc);
}
