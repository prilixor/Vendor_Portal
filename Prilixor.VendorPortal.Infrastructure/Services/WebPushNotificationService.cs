using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using WebPush;
using Microsoft.Extensions.Options;

namespace Prilixor.VendorPortal.Infrastructure.Services;

public class WebPushNotificationService : IPushNotificationService
{
    private readonly VapidDetails _vapidDetails;
    private readonly IVendorOnboardingRepository _repository;

    public WebPushNotificationService(
        IOptions<WebPushOptions> options,
        IVendorOnboardingRepository repository)
    {
        _vapidDetails = new VapidDetails(
            options.Value.Subject,
            options.Value.PublicKey,
            options.Value.PrivateKey);
        _repository = repository;
    }

    public async Task<bool> SendPushNotificationAsync(
        VendorPushSubscription subscription,
        string title,
        string message,
        string? data = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var pushSubscription = new PushSubscription(
                subscription.Endpoint,
                subscription.P256DH,
                subscription.Auth);

            var webPushClient = new WebPushClient();
            var payload = System.Text.Json.JsonSerializer.Serialize(new
            {
                title,
                message,
                data
            });

            await webPushClient.SendNotificationAsync(
                pushSubscription,
                payload,
                _vapidDetails,
                cancellationToken);

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SendPushNotificationToVendorAsync(
        Guid vendorId,
        string title,
        string message,
        string? data = null,
        CancellationToken cancellationToken = default)
    {
        var subscription = await _repository.GetVendorPushSubscriptionAsync(vendorId, cancellationToken);
        if (subscription == null)
            return false;

        return await SendPushNotificationAsync(subscription, title, message, data, cancellationToken);
    }
}

public class WebPushOptions
{
    public const string SectionName = "WebPush";
    public string Subject { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;
}
