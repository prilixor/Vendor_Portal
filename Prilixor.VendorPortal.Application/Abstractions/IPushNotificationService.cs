using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Abstractions;

public interface IPushNotificationService
{
    Task<bool> SendPushNotificationAsync(
        VendorPushSubscription subscription,
        string title,
        string message,
        string? data = null,
        CancellationToken cancellationToken = default);

    Task<bool> SendPushNotificationToVendorAsync(
        Guid vendorId,
        string title,
        string message,
        string? data = null,
        CancellationToken cancellationToken = default);
}
