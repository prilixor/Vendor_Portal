using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.Services;

/// <summary>
/// Promotes the next queued vendor as soon as a pending dispatch offer expires,
/// instead of waiting for a vendor or customer poll.
/// </summary>
public sealed class SequentialDispatchHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<SequentialDispatchHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var dispatch = scope.ServiceProvider.GetRequiredService<ISequentialDispatchService>();
                await dispatch.CascadeExpiredOffersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Sequential dispatch cascade skipped this tick.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
