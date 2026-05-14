using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

internal sealed class GeminiSupportService(
    IHttpClientFactory httpClientFactory,
    IOptions<GeminiOptions> options,
    ILogger<GeminiSupportService> logger)
    : IAiSupportService
{
    private readonly GeminiOptions _options = options.Value;
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
        var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? _options.ApiKey;
        
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("Gemini API key is not configured. Set it in appsettings.json Gemini:ApiKey or environment variable GEMINI_API_KEY.");
            return new AiResponse("I'm sorry, the AI support system is not configured yet. Please contact our support team directly.", false);
        }

        try
        {
            var client = httpClientFactory.CreateClient("Gemini");
            var url = $"{_options.ApiUrl.TrimEnd('/')}?key={apiKey}";

            var contextInfo = $"Category: {category ?? "General"}\nSubject: {subject ?? "N/A"}";

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        role = "user",
                        parts = new[]
                        {
                            new { text = $"{_options.SystemPrompt}\n\n---\n{contextInfo}\n\nVendor message: {vendorMessage}\n\nRespond concisely. If you cannot help, say 'ESCALATE: ' followed by a brief reason." }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.3,
                    maxOutputTokens = 300,
                    topP = 0.9
                }
            };

            HttpResponseMessage response;
            int retryCount = 0;
            const int maxRetries = 3;

            do
            {
                if (retryCount > 0)
                {
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, retryCount)); // 2s, 4s, 8s backoff
                    logger.LogInformation("Retrying Gemini API call in {Delay}s (attempt {Retry}/{MaxRetries})", delay.TotalSeconds, retryCount + 1, maxRetries);
                    await Task.Delay(delay, cancellationToken);
                }

                response = await client.PostAsJsonAsync(url, requestBody, JsonOpts, cancellationToken);

                if (response.IsSuccessStatusCode)
                    break;

                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning("Gemini API returned {StatusCode} (attempt {Retry}): {ErrorBody}", response.StatusCode, retryCount + 1, errorBody);

                retryCount++;

                // Only retry on 429 (rate limit) or 5xx (server errors)
                if ((int)response.StatusCode != 429 && (int)response.StatusCode < 500)
                    break;

            } while (retryCount < maxRetries);

            if (!response.IsSuccessStatusCode)
            {
                var finalErrorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogError("Gemini API request failed after {Retries} retries. Status {StatusCode}: {ErrorBody}", retryCount, response.StatusCode, finalErrorBody);
                return new AiResponse($"I'm sorry, I'm having trouble connecting to my AI engine (HTTP {(int)response.StatusCode}). Our support team has been notified.", false);
            }

            var responseBody = await response.Content.ReadFromJsonAsync<GeminiResponse>(JsonOpts, cancellationToken);

            var text = responseBody?.Candidates?.FirstOrDefault()
                ?.Content?.Parts?.FirstOrDefault()
                ?.Text ?? string.Empty;

            if (string.IsNullOrWhiteSpace(text))
            {
                return new AiResponse("I'm sorry, I couldn't process your request. Our support team will get back to you shortly.", false);
            }

            // Check if AI indicated it cannot answer (ESCALATE prefix)
            if (text.StartsWith("ESCALATE:", StringComparison.OrdinalIgnoreCase))
            {
                var cleanMessage = text["ESCALATE:".Length..].Trim();
                return new AiResponse(cleanMessage, false);
            }

            return new AiResponse(text, true);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Gemini API request failed: {Message}", ex.Message);
            return new AiResponse("I'm experiencing a temporary issue connecting to Gemini. Our support team has been notified and will help you shortly.", false);
        }
        catch (TaskCanceledException)
        {
            logger.LogWarning("Gemini API request timed out.");
            return new AiResponse("The request timed out. Please try again or contact our support team.", false);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error calling Gemini API: {Message}", ex.Message);
            return new AiResponse("An unexpected error occurred. Our support team has been notified.", false);
        }
    }

    // Gemini API response models
    private sealed class GeminiResponse
    {
        [JsonPropertyName("candidates")]
        public Candidate[]? Candidates { get; set; }
    }

    private sealed class Candidate
    {
        [JsonPropertyName("content")]
        public Content? Content { get; set; }

        [JsonPropertyName("finishReason")]
        public string? FinishReason { get; set; }
    }

    private sealed class Content
    {
        [JsonPropertyName("parts")]
        public Part[]? Parts { get; set; }

        [JsonPropertyName("role")]
        public string? Role { get; set; }
    }

    private sealed class Part
    {
        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }
}