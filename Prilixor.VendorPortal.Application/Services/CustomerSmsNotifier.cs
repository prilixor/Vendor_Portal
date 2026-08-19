using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Sends customer SMS when admin flag + phone verified + user prefs allow it.
/// Failures are logged and never fail the main business flow.
/// </summary>
public sealed class CustomerSmsNotifier(
    ICustomerRepository customers,
    ISmsService sms,
    IPlatformSmsSettingsService platformSms,
    ILogger<CustomerSmsNotifier> logger)
{
    public async Task TrySendAsync(
        Guid customerId,
        SmsMessage message,
        CustomerSmsKind kind,
        CancellationToken ct = default)
    {
        try
        {
            if (!sms.IsEnabled)
            {
                logger.LogInformation("Customer SMS skipped: Twilio SMS disabled. CustomerId={CustomerId}", customerId);
                return;
            }

            if (!await platformSms.IsCustomerEventEnabledAsync(kind, ct))
            {
                logger.LogInformation(
                    "Customer SMS skipped: admin flag off. CustomerId={CustomerId} Kind={Kind}",
                    customerId,
                    kind);
                return;
            }

            var customer = await customers.GetCustomerByIdAsync(customerId, ct);
            if (customer is null || customer.IsDeleted)
            {
                logger.LogInformation("Customer SMS skipped: customer missing. CustomerId={CustomerId}", customerId);
                return;
            }

            if (!customer.PhoneVerifiedAt.HasValue)
            {
                logger.LogInformation(
                    "Customer SMS skipped: phone not verified. CustomerId={CustomerId} Phone={Phone}",
                    customerId,
                    customer.Phone);
                return;
            }

            if (!IndianMobilePhone.TryToE164(customer.Phone, out var e164))
            {
                logger.LogInformation(
                    "Customer SMS skipped: invalid phone. CustomerId={CustomerId} Phone={Phone}",
                    customerId,
                    customer.Phone);
                return;
            }

            var prefs = await customers.GetCustomerNotificationPreferenceAsync(customerId, ct);
            if (prefs is not null && !prefs.SmsNotificationsEnabled)
            {
                logger.LogInformation("Customer SMS skipped: SMS pref off. CustomerId={CustomerId}", customerId);
                return;
            }

            if (prefs is not null)
            {
                if (kind == CustomerSmsKind.Expiration)
                {
                    if (!prefs.ExpirationRemindersEnabled)
                    {
                        logger.LogInformation("Customer SMS skipped: expiration pref off. CustomerId={CustomerId}", customerId);
                        return;
                    }
                }
                else if (!prefs.OrderStatusUpdatesEnabled)
                {
                    logger.LogInformation("Customer SMS skipped: order status pref off. CustomerId={CustomerId}", customerId);
                    return;
                }
            }

            logger.LogInformation(
                "Customer SMS sending to {Phone}. CustomerId={CustomerId} Kind={Kind}",
                e164,
                customerId,
                kind);
            var result = await sms.SendAsync(e164, message, ct);
            if (!result.Success)
            {
                logger.LogWarning(
                    "Customer SMS failed for {CustomerId}: {Error}",
                    customerId,
                    result.Error);
            }
            else
            {
                logger.LogInformation(
                    "Customer SMS sent. CustomerId={CustomerId} Sid={Sid}",
                    customerId,
                    result.ProviderMessageSid);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Customer SMS unexpected failure for {CustomerId}", customerId);
        }
    }
}
