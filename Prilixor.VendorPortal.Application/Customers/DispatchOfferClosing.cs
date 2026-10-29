using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ClosedVendorOfferNotice(Guid VendorId, string OrderNumber, string OrderStatus);

/// <summary>
/// A vendor request stays open only while the product is awaiting acceptance.
/// Customer cancel, admin cancel, and dispatch failure close the pending and queued offers.
/// </summary>
public static class DispatchOfferClosing
{
    public static async Task CloseForOrderAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        Guid orderId,
        string orderNumber,
        string message,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var offers = await customers.GetCustomerOrderVendorOffersAsync(orderId, cancellationToken);
        var pendingVendorIds = new List<Guid>();
        foreach (var offer in offers)
        {
            if (!SequentialDispatchRules.IsOpenOffer(offer.Status))
                continue;
            if (string.Equals(offer.Status, SequentialDispatchRules.Pending, StringComparison.OrdinalIgnoreCase))
                pendingVendorIds.Add(offer.VendorId);
            offer.Status = SequentialDispatchRules.Expired;
            offer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        foreach (var vendorId in pendingVendorIds.Distinct())
            await NotifyClosedAsync(vendors, vendorId, orderNumber, message, now, cancellationToken);
    }

    public static string MessageForClosedOrder(string orderNumber, string orderStatus)
    {
        if (string.Equals(orderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)
            || string.Equals(orderStatus, "canceled", StringComparison.OrdinalIgnoreCase))
            return $"{orderNumber} was cancelled before a vendor accepted it. This request is closed.";
        if (string.Equals(orderStatus, "dispatch_failed", StringComparison.OrdinalIgnoreCase))
            return $"{orderNumber} is dispatch failed. This request is closed.";
        return $"{orderNumber} is no longer waiting for a vendor. This request is closed.";
    }

    public static Task NotifyClosedAsync(
        IVendorOnboardingRepository vendors,
        Guid vendorId,
        string orderNumber,
        string message,
        DateTimeOffset now,
        CancellationToken cancellationToken) =>
        vendors.AddVendorNotificationAsync(
            new VendorNotification
            {
                VendorId = vendorId,
                NotificationType = "order_status_updated",
                Title = $"{orderNumber} closed",
                Message = message,
                Channel = "in_app",
                Status = "sent",
                SentAt = now,
            },
            cancellationToken);
}
