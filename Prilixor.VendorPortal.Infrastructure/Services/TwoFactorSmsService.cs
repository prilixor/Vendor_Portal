using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

/// <summary>
/// 2Factor transactional SMS. Personal/trial accounts usually need DLT before this works;
/// leave <see cref="TwoFactorOptions.TransactionalSmsEnabled"/> false until Business + PE ready.
/// </summary>
public sealed class TwoFactorSmsService(
    IHttpClientFactory httpClientFactory,
    IOptions<TwoFactorOptions> options,
    ILogger<TwoFactorSmsService> logger) : ISmsService
{
    private readonly TwoFactorOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && _options.TransactionalSmsEnabled
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    public async Task<SmsSendResult> SendAsync(string e164Phone, SmsMessage message, CancellationToken ct = default)
    {
        if (!IsEnabled)
        {
            logger.LogInformation(
                "SMS skipped (2Factor transactional disabled or not configured). To={Phone}",
                e164Phone);
            return new SmsSendResult(true, null, null);
        }

        try
        {
            var phone = TwoFactorPhoneVerificationService.ToTwoFactorPhone(e164Phone);
            var client = httpClientFactory.CreateClient("TwoFactor");
            var apiKey = Uri.EscapeDataString(_options.ApiKey.Trim());
            var baseUrl = (_options.BaseUrl ?? string.Empty).TrimEnd('/');

            // Legacy transactional addon endpoint (requires DLT-approved sender + template for India).
            var url = $"{baseUrl}/{apiKey}/ADDON_SERVICES/SEND/TSMS";
            var form = new Dictionary<string, string>
            {
                ["From"] = string.IsNullOrWhiteSpace(_options.SenderId) ? "BLINKS" : _options.SenderId.Trim(),
                ["To"] = phone,
                ["Msg"] = message.Body ?? string.Empty
            };

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
                // ignore parse errors; log raw below
            }

            if (payload is not null && string.Equals(payload.Status, "Success", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogInformation(
                    "2Factor SMS accepted. To={Phone} Details={Details}",
                    e164Phone,
                    payload.Details);
                return new SmsSendResult(true, payload.Details, null);
            }

            logger.LogError(
                "2Factor SMS failed. To={Phone} Http={Status} Body={Body}",
                e164Phone,
                (int)response.StatusCode,
                Truncate(raw, 500));
            return new SmsSendResult(false, null, payload?.Details ?? "2Factor SMS send failed");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "2Factor SMS send failed to {Phone}", e164Phone);
            return new SmsSendResult(false, null, ex.Message);
        }
    }

    private static string Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max] + "…";

    private sealed class TwoFactorApiResponse
    {
        [JsonPropertyName("Status")]
        public string? Status { get; set; }

        [JsonPropertyName("Details")]
        public string? Details { get; set; }
    }
}
