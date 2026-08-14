using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Creates in-app expiration notifications and optional SMS (deduped per order).
/// </summary>
public sealed class CustomerExpirationReminderNotifier(
    ICustomerRepository customers,
    CustomerSmsNotifier customerSms,
    ILogger<CustomerExpirationReminderNotifier> logger)
{
    public async Task EnsureRemindersAsync(
        Guid customerId,
        IEnumerable<ExpiringOrderAggregate> rows,
        DateOnly fromDate,
        CancellationToken ct = default)
    {
        var due = rows.Where(r => DaysLeft(r, fromDate) <= 3).ToList();
        if (due.Count == 0)
            return;

        var existing = await customers.GetCustomerNotificationsAsync(customerId, ct);
        var existingKeys = existing
            .Where(x => x.NotificationType == CustomerNotificationTypes.OrderExpiringSoon && x.RelatedOrderId.HasValue)
            .Select(x => x.RelatedOrderId!.Value)
            .ToHashSet();

        var created = 0;
        foreach (var row in due)
        {
            if (existingKeys.Contains(row.OrderId))
                continue;

            var daysLeft = DaysLeft(row, fromDate);
            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = customerId,
                    Title = $"Order {row.OrderNumber} expires in {daysLeft} day(s)",
                    Body = $"Your {row.OrderType} item \"{row.ListingTitle}\" is due on {row.EndDate:dd MMM yyyy}.",
                    NotificationType = CustomerNotificationTypes.OrderExpiringSoon,
                    RelatedOrderId = row.OrderId,
                },
                ct);

            await customerSms.TrySendAsync(
                customerId,
                SmsTemplates.CustomerOrderExpiringSoon(row.OrderNumber, daysLeft, row.EndDate),
                CustomerSmsKind.Expiration,
                ct);

            existingKeys.Add(row.OrderId);
            created++;
        }

        if (created > 0)
        {
            await customers.SaveChangesAsync(ct);
            logger.LogInformation(
                "Customer expiration reminders created. CustomerId={CustomerId} Count={Count}",
                customerId,
                created);
        }
    }

    private static int DaysLeft(ExpiringOrderAggregate row, DateOnly fromDate) =>
        Math.Max(0, row.EndDate.DayNumber - fromDate.DayNumber);
}
