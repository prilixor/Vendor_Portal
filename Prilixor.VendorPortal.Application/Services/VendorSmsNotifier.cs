using Microsoft.Extensions.Logging;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Common;

namespace Prilixor.VendorPortal.Application.Services;

/// <summary>
/// Sends vendor SMS when admin flag + phone verified + SMS prefs allow it.
/// Failures are logged and never fail the main business flow.
/// </summary>
public sealed class VendorSmsNotifier(
    IVendorOnboardingRepository vendors,
    ISmsService sms,
    IPlatformSmsSettingsService platformSms,
    ILogger<VendorSmsNotifier> logger)
{
    public Task TrySendAsync(Guid vendorId, SmsMessage message, CancellationToken ct = default) =>
        TrySendAsync(vendorId, message, VendorSmsKind.NewOrder, ct);

    public async Task TrySendAsync(
        Guid vendorId,
        SmsMessage message,
        VendorSmsKind kind,
        CancellationToken ct = default)
    {
        try
        {
            if (!sms.IsEnabled)
            {
                logger.LogInformation("Vendor SMS skipped: Twilio SMS disabled. VendorId={VendorId}", vendorId);
                return;
            }

            if (!await platformSms.IsVendorEventEnabledAsync(kind, ct))
            {
                logger.LogInformation(
                    "Vendor SMS skipped: admin flag off. VendorId={VendorId} Kind={Kind}",
                    vendorId,
                    kind);
                return;
            }

            var vendor = await vendors.GetVendorByIdAsync(vendorId, ct);
            if (vendor is null || vendor.IsDeleted)
            {
                logger.LogInformation("Vendor SMS skipped: vendor missing. VendorId={VendorId}", vendorId);
                return;
            }

            if (!vendor.PhoneVerifiedAt.HasValue)
            {
                logger.LogInformation(
                    "Vendor SMS skipped: phone not verified. VendorId={VendorId} Phone={Phone}",
                    vendorId,
                    vendor.SupportPhone);
                return;
            }

            if (!IndianMobilePhone.TryToE164(vendor.SupportPhone, out var e164))
            {
                logger.LogInformation(
                    "Vendor SMS skipped: invalid phone. VendorId={VendorId} Phone={Phone}",
                    vendorId,
                    vendor.SupportPhone);
                return;
            }

            var prefs = await vendors.GetVendorNotificationPreferenceAsync(vendorId, ct);
            if (prefs is not null && !prefs.SmsNotificationsEnabled)
            {
                logger.LogInformation("Vendor SMS skipped: SMS pref off. VendorId={VendorId}", vendorId);
                return;
            }

            if (kind == VendorSmsKind.NewOrder && prefs is not null && !prefs.NewOrderNotifications)
            {
                logger.LogInformation("Vendor SMS skipped: new-order pref off. VendorId={VendorId}", vendorId);
                return;
            }

            logger.LogInformation(
                "Vendor SMS sending to {Phone}. VendorId={VendorId} Kind={Kind}",
                e164,
                vendorId,
                kind);
            var result = await sms.SendAsync(e164, message, ct);
            if (!result.Success)
            {
                logger.LogWarning(
                    "Vendor SMS failed for {VendorId}: {Error}",
                    vendorId,
                    result.Error);
            }
            else
            {
                logger.LogInformation(
                    "Vendor SMS sent. VendorId={VendorId} Sid={Sid}",
                    vendorId,
                    result.ProviderMessageSid);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Vendor SMS unexpected failure for {VendorId}", vendorId);
        }
    }
}
