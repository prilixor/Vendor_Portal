using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

/// <summary>
/// Transactional ShreeSMS. OTP does not use this type.
/// Order and account texts stay off until each DLT template is approved.
/// </summary>
public sealed class ShreeSmsService(
    IOptions<ShreeSmsOptions> options,
    ILogger<ShreeSmsService> logger) : ISmsService
{
    private readonly ShreeSmsOptions _options = options.Value;

    public bool IsEnabled =>
        _options.Enabled
        && _options.TransactionalSmsEnabled
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    public Task<SmsSendResult> SendAsync(string e164Phone, SmsMessage message, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Transactional SMS skipped (ShreeSMS templates not enabled). To={Phone}",
            e164Phone);
        return Task.FromResult(new SmsSendResult(true, null, null));
    }
}
