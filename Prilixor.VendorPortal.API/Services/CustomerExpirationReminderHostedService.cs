using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Services;

namespace Prilixor.VendorPortal.API.Services;

/// <summary>
/// Periodically scans rentals due within 3 days and creates customer expiration reminders + SMS.
/// </summary>
public sealed class CustomerExpirationReminderHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<CustomerExpirationReminderHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Customer expiration reminder job failed.");
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

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var customers = scope.ServiceProvider.GetRequiredService<ICustomerRepository>();
        var notifier = scope.ServiceProvider.GetRequiredService<CustomerExpirationReminderNotifier>();

        var fromDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var toDate = fromDate.AddDays(3);
        var rows = await customers.GetExpiringOrdersForAdminAsync(fromDate, toDate, ct);
        if (rows.Count == 0)
        {
            logger.LogDebug("Customer expiration reminder job: no due rentals.");
            return;
        }

        foreach (var group in rows.GroupBy(r => r.CustomerId))
        {
            await notifier.EnsureRemindersAsync(group.Key, group, fromDate, ct);
        }

        logger.LogInformation(
            "Customer expiration reminder job finished. OrdersScanned={Count}",
            rows.Count);
    }
}
