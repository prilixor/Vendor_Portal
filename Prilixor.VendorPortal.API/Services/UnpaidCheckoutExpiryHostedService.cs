using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Customers;

namespace Prilixor.VendorPortal.API.Services;

/// <summary>
/// Cancels checkout drafts that were never paid (customer closed Razorpay and left), so they stop
/// holding stock and showing up as orders. Setting: <c>Checkout:UnpaidOrderExpiryMinutes</c> (default 30).
/// </summary>
public sealed class UnpaidCheckoutExpiryHostedService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<UnpaidCheckoutExpiryHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = configuration.GetValue("Checkout:UnpaidOrderExpiryMinutes", 30);
        var maxAge = TimeSpan.FromMinutes(Math.Clamp(minutes, 5, 24 * 60));

        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
                await mediator.Send(new ExpireUnpaidCheckoutsCommand(maxAge), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Unpaid checkout expiry skipped this tick.");
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
