using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class GroqSupportService(
    IHttpClientFactory httpClientFactory,
    IOptions<GroqOptions> options,
    ILogger<GroqSupportService> logger)
    : IAiSupportService
{
    private readonly GroqOptions _options = options.Value;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<AiResponse> GenerateResponseAsync(
        string vendorMessage,
        string? category,
        string? subject,
        CancellationToken cancellationToken,
        List<(string SenderType, string Message)>? conversationHistory = null)
    {
        // Try environment variable first, then appsettings
        var apiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY") ?? _options.ApiKey;

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("Groq API key is not configured. Set it in appsettings.json Groq:ApiKey or environment variable GROQ_API_KEY.");
            return new AiResponse("Our support team will assist you shortly.", false);
        }

        try
        {
            var client = httpClientFactory.CreateClient("Groq");
            var url = _options.ApiUrl.TrimEnd('/');

            var contextInfo = $"Category: {category ?? "General"}\nSubject: {subject ?? "N/A"}";

            // Build messages array with conversation history
            var messagesList = new List<object>();
            messagesList.Add(new { role = "system", content = _options.SystemPrompt });

            // Add conversation history for context (to avoid repetitive answers)
            if (conversationHistory != null && conversationHistory.Count > 0)
            {
                foreach (var (senderType, message) in conversationHistory)
                {
                    var role = senderType == "Vendor" ? "user" : "assistant";
                    messagesList.Add(new { role, content = message });
                }
            }

            // Add current vendor message
            messagesList.Add(new { role = "user", content = $"{contextInfo}\n\nVendor's new message: {vendorMessage}" });

            var requestBody = new
            {
                model = _options.Model,
                messages = messagesList,
                temperature = 0.7,
                max_tokens = 300,
                top_p = 0.95
            };

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(requestBody, options: JsonOpts)
            };
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            httpRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            HttpResponseMessage response;
            int retryCount = 0;
            const int maxRetries = 3;

            do
            {
                if (retryCount > 0)
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, retryCount));
                    logger.LogInformation("Retrying Groq API call in {Delay}s (attempt {Retry}/{MaxRetries})", delay.TotalSeconds, retryCount + 1, maxRetries);
                    await Task.Delay(delay, cancellationToken);
                }

                response = await client.SendAsync(httpRequest, cancellationToken);

                if (response.IsSuccessStatusCode)
                    break;

                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning("Groq API returned {StatusCode} (attempt {Retry}): {ErrorBody}", response.StatusCode, retryCount + 1, errorBody);

                retryCount++;

                // Only retry on 429 (rate limit) or 5xx (server errors)
                if ((int)response.StatusCode != 429 && (int)response.StatusCode < 500)
                    break;

            } while (retryCount < maxRetries);

            if (!response.IsSuccessStatusCode)
            {
                var finalErrorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError("Groq API request failed after {Retries} retries. Status {StatusCode}: {ErrorBody}", retryCount, response.StatusCode, finalErrorBody);
                return new AiResponse("Our support team will assist you shortly.", false);
            }

            var responseBody = await response.Content.ReadFromJsonAsync<GroqResponse>(JsonOpts, cancellationToken);

            var text = responseBody?.Choices?.FirstOrDefault()
                ?.Message?.Content ?? string.Empty;

            if (string.IsNullOrWhiteSpace(text))
            {
                return new AiResponse("Our support team will assist you shortly.", false);
            }

            // Check if AI indicated it cannot answer (ESCALATE prefix)
            if (text.StartsWith("ESCALATE:", StringComparison.OrdinalIgnoreCase))
            {
                var cleanMessage = text["ESCALATE:".Length..].Trim();
                return new AiResponse(cleanMessage, false);
            }

            return new AiResponse(text.Trim(), true);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Groq API request failed: {Message}", ex.Message);
            return new AiResponse("Our support team will assist you shortly.", false);
        }
        catch (TaskCanceledException)
        {
            logger.LogWarning("Groq API request timed out.");
            return new AiResponse("Our support team will assist you shortly.", false);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error calling Groq API: {Message}", ex.Message);
            return new AiResponse("Our support team will assist you shortly.", false);
        }
    }

    // Groq API response model (OpenAI-compatible format)
    private sealed class GroqResponse
    {
        [JsonPropertyName("choices")]
        public Choice[]? Choices { get; set; }
    }

    private sealed class Choice
    {
        [JsonPropertyName("message")]
        public GroqMessage? Message { get; set; }

        [JsonPropertyName("finish_reason")]
        public string? FinishReason { get; set; }
    }

    private sealed class GroqMessage
    {
        [JsonPropertyName("role")]
        public string? Role { get; set; }

        [JsonPropertyName("content")]
        public string? Content { get; set; }
    }
}