using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public sealed class RazorpayPaymentService(
    IHttpClientFactory httpClientFactory,
    IOptions<RazorpayOptions> options,
    ILogger<RazorpayPaymentService> logger) : IRazorpayPaymentService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly RazorpayOptions _options = options.Value;

    public bool IsConfigured =>
        _options.Enabled
        && !string.IsNullOrWhiteSpace(_options.KeyId)
        && !string.IsNullOrWhiteSpace(_options.KeySecret);

    public string KeyId => _options.KeyId;

    public async Task<RazorpayOrderCreateResult> CreateOrderAsync(
        long amountPaise,
        string currency,
        string receipt,
        IReadOnlyDictionary<string, string>? notes,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var payload = new Dictionary<string, object?>
        {
            ["amount"] = amountPaise,
            ["currency"] = currency,
            ["receipt"] = receipt,
            ["payment_capture"] = 1,
        };
        if (notes is { Count: > 0 })
            payload["notes"] = notes;

        using var doc = await SendJsonAsync(HttpMethod.Post, "https://api.razorpay.com/v1/orders", payload, cancellationToken);
        var root = doc.RootElement;
        var orderId = root.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Razorpay order response missing id.");
        var amount = root.GetProperty("amount").GetInt64();
        var curr = root.GetProperty("currency").GetString() ?? currency;
        var rec = root.TryGetProperty("receipt", out var r) ? r.GetString() ?? receipt : receipt;
        return new RazorpayOrderCreateResult(orderId, amount, curr, rec);
    }

    public async Task<RazorpayPaymentLinkCreateResult> CreatePaymentLinkAsync(
        long amountPaise,
        string currency,
        string description,
        string customerName,
        string customerEmail,
        string? customerPhone,
        string referenceId,
        string callbackUrl,
        IReadOnlyDictionary<string, string>? notes,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();

        var customer = new Dictionary<string, object?>
        {
            ["name"] = customerName,
            ["email"] = customerEmail,
        };
        if (!string.IsNullOrWhiteSpace(customerPhone))
            customer["contact"] = customerPhone;

        var payload = new Dictionary<string, object?>
        {
            ["amount"] = amountPaise,
            ["currency"] = currency,
            ["accept_partial"] = false,
            ["description"] = description,
            ["customer"] = customer,
            ["notify"] = new Dictionary<string, object?> { ["sms"] = false, ["email"] = true },
            ["reminder_enable"] = true,
            ["reference_id"] = referenceId,
            ["callback_url"] = callbackUrl,
            ["callback_method"] = "get",
        };
        if (notes is { Count: > 0 })
            payload["notes"] = notes;

        using var doc = await SendJsonAsync(HttpMethod.Post, "https://api.razorpay.com/v1/payment_links", payload, cancellationToken);
        var root = doc.RootElement;
        var linkId = root.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Razorpay payment link response missing id.");
        var shortUrl = root.GetProperty("short_url").GetString()
            ?? throw new InvalidOperationException("Razorpay payment link response missing short_url.");
        string? orderId = null;
        if (root.TryGetProperty("order_id", out var oid) && oid.ValueKind == JsonValueKind.String)
            orderId = oid.GetString();
        return new RazorpayPaymentLinkCreateResult(linkId, shortUrl, orderId);
    }

    public bool VerifyPaymentSignature(string razorpayOrderId, string razorpayPaymentId, string razorpaySignature)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(razorpaySignature))
            return false;

        var payload = $"{razorpayOrderId}|{razorpayPaymentId}";
        var expected = ComputeHmacHex(_options.KeySecret, payload);
        return FixedTimeEqualsHex(expected, razorpaySignature);
    }

    public bool VerifyWebhookSignature(string rawBody, string signatureHeader)
    {
        if (string.IsNullOrWhiteSpace(_options.WebhookSecret) || string.IsNullOrWhiteSpace(signatureHeader))
            return false;

        var expected = ComputeHmacHex(_options.WebhookSecret, rawBody);
        return FixedTimeEqualsHex(expected, signatureHeader);
    }

    private static bool FixedTimeEqualsHex(string expectedHex, string actualHex)
    {
        var actual = actualHex.Trim();
        if (expectedHex.Length != actual.Length)
            return false;
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHex),
            Encoding.UTF8.GetBytes(actual));
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Razorpay is not configured. Set Razorpay:KeyId and Razorpay:KeySecret.");
    }

    private async Task<JsonDocument> SendJsonAsync(
        HttpMethod method,
        string url,
        object payload,
        CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("Razorpay");
        using var request = new HttpRequestMessage(method, url);
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.KeyId}:{_options.KeySecret}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Razorpay API {Status}: {Body}", (int)response.StatusCode, body);
            throw new InvalidOperationException($"Razorpay API failed with status {(int)response.StatusCode}.");
        }

        return JsonDocument.Parse(body);
    }

    private static string ComputeHmacHex(string secret, string payload)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
