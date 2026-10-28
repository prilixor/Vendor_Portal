using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class CashfreeVerificationService(
    IHttpClientFactory httpClientFactory,
    IOptions<CashfreeOptions> options,
    ILogger<CashfreeVerificationService> logger)
    : ICashfreeVerificationService
{
    private readonly CashfreeOptions _options = options.Value;

    private (string ClientId, string ClientSecret) ResolveCredentials()
    {
        var clientId = Environment.GetEnvironmentVariable("CASHFREE_CLIENT_ID") ?? _options.ClientId;
        var clientSecret = Environment.GetEnvironmentVariable("CASHFREE_CLIENT_SECRET") ?? _options.ClientSecret;
        return (clientId?.Trim() ?? string.Empty, clientSecret?.Trim() ?? string.Empty);
    }

    private HttpClient CreateConfiguredClient(string clientId, string clientSecret)
    {
        var client = httpClientFactory.CreateClient("Cashfree");
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("x-client-id", clientId);
        client.DefaultRequestHeaders.Add("x-client-secret", clientSecret);
        return client;
    }

    public async Task<GstinVerificationResult> VerifyGstinAsync(string gstin, CancellationToken ct = default)
    {
        var normalizedGstin = (gstin ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalizedGstin))
        {
            return new GstinVerificationResult(false, normalizedGstin, null, null, null, null, null, null, null, "GSTIN cannot be empty.");
        }

        var (clientId, clientSecret) = ResolveCredentials();
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            logger.LogWarning("Cashfree credentials are not configured. Returning unconfigured status for GSTIN verification.");
            return new GstinVerificationResult(false, normalizedGstin, null, null, null, null, null, null, null, "Cashfree verification credentials are not configured.");
        }

        try
        {
            var client = CreateConfiguredClient(clientId, clientSecret);
            var url = $"{_options.BaseUrl.TrimEnd('/')}/gstin";

            var payload = new Dictionary<string, string>
            {
                ["gstin"] = normalizedGstin,
                ["GSTIN"] = normalizedGstin
            };
            using var response = await client.PostAsJsonAsync(url, payload, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Cashfree GSTIN verification HTTP {Status}: {Body}", response.StatusCode, responseBody);
                return TryParseErrorResponse(responseBody, normalizedGstin);
            }

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var status = GetStringProp(root, "status", "gstin_status", "verification_status");
            var valid = GetBoolProp(root, "valid") ?? string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase) || string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase);

            var legalName = GetStringProp(root, "legal_name_of_business", "legal_name", "trade_name", "business_name");
            var tradeName = GetStringProp(root, "trade_name", "legal_name_of_business");
            var gstinStatus = GetStringProp(root, "gstin_status", "status");
            var message = GetStringProp(root, "message");

            string? address = null;
            string? state = null;
            string? pincode = null;

            if (root.TryGetProperty("principal_place_of_business_fields", out var addrEl) && addrEl.ValueKind == JsonValueKind.Object)
            {
                address = GetStringProp(addrEl, "address", "principal_place_of_business");
                state = GetStringProp(addrEl, "state");
                pincode = GetStringProp(addrEl, "pincode");
            }

            return new GstinVerificationResult(
                IsValid: valid,
                Gstin: normalizedGstin,
                LegalName: legalName,
                TradeName: tradeName,
                Status: gstinStatus ?? status,
                Address: address,
                State: state,
                City: null,
                Pincode: pincode,
                Message: message ?? (valid ? "GSTIN verified successfully." : "GSTIN verification failed."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error verifying GSTIN {Gstin} with Cashfree", normalizedGstin);
            return new GstinVerificationResult(false, normalizedGstin, null, null, null, null, null, null, null, $"Verification request error: {ex.Message}");
        }
    }

    public async Task<PanVerificationResult> VerifyPanAsync(string pan, string? nameToMatch = null, CancellationToken ct = default)
    {
        var normalizedPan = (pan ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalizedPan))
        {
            return new PanVerificationResult(false, normalizedPan, null, null, null, null, "PAN cannot be empty.");
        }

        var (clientId, clientSecret) = ResolveCredentials();
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            logger.LogWarning("Cashfree credentials are not configured. Returning unconfigured status for PAN verification.");
            return new PanVerificationResult(false, normalizedPan, null, null, null, null, "Cashfree verification credentials are not configured.");
        }

        try
        {
            var client = CreateConfiguredClient(clientId, clientSecret);
            var url = $"{_options.BaseUrl.TrimEnd('/')}/pan";

            object payload = string.IsNullOrWhiteSpace(nameToMatch)
                ? new { pan = normalizedPan }
                : new { pan = normalizedPan, name = nameToMatch.Trim() };

            using var response = await client.PostAsJsonAsync(url, payload, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Cashfree PAN verification HTTP {Status}: {Body}", response.StatusCode, responseBody);
                return TryParsePanErrorResponse(responseBody, normalizedPan);
            }

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var status = GetStringProp(root, "status", "pan_status", "verification_status");
            var valid = GetBoolProp(root, "valid") ?? string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase) || string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase);

            var registeredName = GetStringProp(root, "registered_name", "name");
            var type = GetStringProp(root, "type");
            var matchResult = GetStringProp(root, "name_match_result");
            var matchScore = GetDoubleProp(root, "name_match_score");
            var message = GetStringProp(root, "message");

            return new PanVerificationResult(
                IsValid: valid,
                Pan: normalizedPan,
                RegisteredName: registeredName,
                Type: type,
                NameMatchResult: matchResult,
                NameMatchScore: matchScore,
                Message: message ?? (valid ? "PAN verified successfully." : "PAN verification failed."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error verifying PAN {Pan} with Cashfree", normalizedPan);
            return new PanVerificationResult(false, normalizedPan, null, null, null, null, $"Verification request error: {ex.Message}");
        }
    }

    public async Task<BankAccountVerificationResult> VerifyBankAccountAsync(
        string accountNumber,
        string ifsc,
        string? nameToMatch = null,
        string? phone = null,
        CancellationToken ct = default)
    {
        var cleanAcc = (accountNumber ?? string.Empty).Trim();
        var cleanIfsc = (ifsc ?? string.Empty).Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(cleanAcc) || string.IsNullOrWhiteSpace(cleanIfsc))
        {
            return new BankAccountVerificationResult(false, cleanAcc, cleanIfsc, null, null, null, null, null, "Account number and IFSC code are required.");
        }

        var (clientId, clientSecret) = ResolveCredentials();
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
        {
            logger.LogWarning("Cashfree credentials are not configured. Returning unconfigured status for Bank Account verification.");
            return new BankAccountVerificationResult(false, cleanAcc, cleanIfsc, null, null, null, null, null, "Cashfree verification credentials are not configured.");
        }

        try
        {
            var client = CreateConfiguredClient(clientId, clientSecret);
            var url = $"{_options.BaseUrl.TrimEnd('/')}/bank-account/sync";

            var payload = new Dictionary<string, string>
            {
                ["bank_account"] = cleanAcc,
                ["ifsc"] = cleanIfsc
            };

            if (!string.IsNullOrWhiteSpace(nameToMatch))
            {
                payload["name"] = nameToMatch.Trim();
            }

            if (!string.IsNullOrWhiteSpace(phone))
            {
                payload["phone"] = phone.Trim();
            }

            using var response = await client.PostAsJsonAsync(url, payload, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Cashfree Bank Account verification HTTP {Status}: {Body}", response.StatusCode, responseBody);
                return TryParseBankErrorResponse(responseBody, cleanAcc, cleanIfsc);
            }

            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var status = GetStringProp(root, "status", "account_status");
            var accountStatus = GetStringProp(root, "account_status", "status");
            var valid = string.Equals(accountStatus, "VALID", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase);

            var registeredName = GetStringProp(root, "registered_name", "account_holder_name", "name");
            var bankName = GetStringProp(root, "bank_name");
            var matchResult = GetStringProp(root, "name_match_result");
            var matchScore = GetDoubleProp(root, "name_match_score");
            var utr = GetStringProp(root, "utr");
            var message = GetStringProp(root, "message");

            return new BankAccountVerificationResult(
                IsValid: valid,
                AccountNumber: cleanAcc,
                Ifsc: cleanIfsc,
                RegisteredName: registeredName,
                BankName: bankName,
                NameMatchResult: matchResult,
                NameMatchScore: matchScore,
                Utr: utr,
                Message: message ?? (valid ? "Bank account verified successfully." : "Bank account verification failed."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error verifying Bank Account {Acc} IFSC {Ifsc} with Cashfree", cleanAcc, cleanIfsc);
            return new BankAccountVerificationResult(false, cleanAcc, cleanIfsc, null, null, null, null, null, $"Verification request error: {ex.Message}");
        }
    }

    private static GstinVerificationResult TryParseErrorResponse(string body, string gstin)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var msg = GetStringProp(doc.RootElement, "message", "error", "description");
            return new GstinVerificationResult(false, gstin, null, null, null, null, null, null, null, msg ?? "GSTIN verification failed.");
        }
        catch
        {
            return new GstinVerificationResult(false, gstin, null, null, null, null, null, null, null, "GSTIN verification failed.");
        }
    }

    private static PanVerificationResult TryParsePanErrorResponse(string body, string pan)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var msg = GetStringProp(doc.RootElement, "message", "error", "description");
            return new PanVerificationResult(false, pan, null, null, null, null, msg ?? "PAN verification failed.");
        }
        catch
        {
            return new PanVerificationResult(false, pan, null, null, null, null, "PAN verification failed.");
        }
    }

    private static BankAccountVerificationResult TryParseBankErrorResponse(string body, string acc, string ifsc)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var msg = GetStringProp(doc.RootElement, "message", "error", "description");
            return new BankAccountVerificationResult(false, acc, ifsc, null, null, null, null, null, msg ?? "Bank account verification failed.");
        }
        catch
        {
            return new BankAccountVerificationResult(false, acc, ifsc, null, null, null, null, null, "Bank account verification failed.");
        }
    }

    private static string? GetStringProp(JsonElement element, params string[] propertyNames)
    {
        foreach (var name in propertyNames)
        {
            if (element.TryGetProperty(name, out var val) && val.ValueKind == JsonValueKind.String)
            {
                var str = val.GetString();
                if (!string.IsNullOrWhiteSpace(str)) return str;
            }
        }
        return null;
    }

    private static bool? GetBoolProp(JsonElement element, string propName)
    {
        if (element.TryGetProperty(propName, out var val))
        {
            if (val.ValueKind == JsonValueKind.True) return true;
            if (val.ValueKind == JsonValueKind.False) return false;
            if (val.ValueKind == JsonValueKind.String && bool.TryParse(val.GetString(), out var b)) return b;
        }
        return null;
    }

    private static double? GetDoubleProp(JsonElement element, string propName)
    {
        if (element.TryGetProperty(propName, out var val))
        {
            if (val.ValueKind == JsonValueKind.Number && val.TryGetDouble(out var d)) return d;
            if (val.ValueKind == JsonValueKind.String && double.TryParse(val.GetString(), out var d2)) return d2;
        }
        return null;
    }
}
