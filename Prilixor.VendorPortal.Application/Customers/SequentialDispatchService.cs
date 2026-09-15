using Microsoft.Extensions.Options;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public interface ISequentialDispatchService
{
    /// <summary>Creates one pending offer plus queued remainder. Notifies only the pending vendor.</summary>
    Task<bool> StartWaveAsync(
        CustomerRentalOrder order,
        Guid productId,
        IReadOnlyCollection<Guid> excludeVendorIds,
        string listingTitle,
        CancellationToken cancellationToken);

    /// <summary>Expire due pending offers and activate the next queued vendor, or fail the order.</summary>
    Task<bool> ReconcileAwaitingOrderAsync(
        Guid orderId,
        DateTimeOffset now,
        CancellationToken cancellationToken);

    Task FailDispatchAsync(
        CustomerRentalOrder order,
        Guid? actorId,
        string customerBody,
        CancellationToken cancellationToken);

    Task CascadeExpiredOffersAsync(CancellationToken cancellationToken);

    Task PersistAsync(CancellationToken cancellationToken);
}

internal sealed class SequentialDispatchService(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IVendorUploadStorageService uploadStorage,
    IOptions<CustomerPricingOptions> pricingOptions) : ISequentialDispatchService
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;
    private bool customersDirty;
    private bool vendorsDirty;

    public async Task PersistAsync(CancellationToken cancellationToken)
    {
        if (customersDirty)
        {
            await customers.SaveChangesAsync(cancellationToken);
            customersDirty = false;
        }

        if (vendorsDirty)
        {
            await vendors.SaveChangesAsync(cancellationToken);
            vendorsDirty = false;
        }
    }

    public async Task CascadeExpiredOffersAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var orderIds = await customers.GetAwaitingOrderIdsWithExpiredPendingOffersAsync(now, cancellationToken);
        var changed = false;
        foreach (var orderId in orderIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            changed |= await ReconcileAwaitingOrderAsync(orderId, now, cancellationToken);
        }

        if (changed)
            await PersistAsync(cancellationToken);
    }

    public async Task<bool> StartWaveAsync(
        CustomerRentalOrder order,
        Guid productId,
        IReadOnlyCollection<Guid> excludeVendorIds,
        string listingTitle,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await ExpireOpenOffersAsync(order.Id, now, cancellationToken);
        await PersistAsync(cancellationToken);

        var exclude = excludeVendorIds.ToHashSet();
        var preferred = await GetPreferredSiblingVendorIdsAsync(order, cancellationToken);
        var ranked = await RankEligibleAsync(order, productId, exclude, preferred, cancellationToken);
        if (ranked.Count == 0)
            return false;

        var ttl = SequentialDispatchRules.OfferTtl(options);
        for (var i = 0; i < ranked.Count; i++)
        {
            var candidate = ranked[i];
            var offer = new CustomerOrderVendorOffer
            {
                CustomerRentalOrderId = order.Id,
                VendorId = candidate.VendorId,
                VendorProductListingId = candidate.ListingId,
                OfferRank = i + 1,
                Status = i == 0 ? SequentialDispatchRules.Pending : SequentialDispatchRules.Queued,
                ExpiresAt = now.Add(ttl),
            };
            await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
            customersDirty = true;
        }

        await NotifyVendorTurnAsync(ranked[0].VendorId, order, listingTitle, cancellationToken);
        return true;
    }

    public async Task<bool> ReconcileAwaitingOrderAsync(
        Guid orderId,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var order = await customers.GetCustomerOrderEntityByIdAsync(orderId, cancellationToken);
        if (order is null || order.IsDeleted)
            return false;
        if (!string.Equals(order.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase))
            return false;

        var offers = await customers.GetCustomerOrderVendorOffersAsync(order.Id, cancellationToken);
        var changed = false;

        foreach (var expired in offers.Where(x =>
                     string.Equals(x.Status, SequentialDispatchRules.Pending, StringComparison.OrdinalIgnoreCase)
                     && x.ExpiresAt <= now))
        {
            expired.Status = SequentialDispatchRules.Expired;
            expired.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(expired, cancellationToken);
            changed = true;
            customersDirty = true;
        }

        if (offers.Any(x => string.Equals(x.Status, SequentialDispatchRules.Accepted, StringComparison.OrdinalIgnoreCase)))
            return changed;

        var hasActivePending = offers.Any(x =>
            string.Equals(x.Status, SequentialDispatchRules.Pending, StringComparison.OrdinalIgnoreCase)
            && x.ExpiresAt > now);
        if (hasActivePending)
            return changed;

        // Unique index allows only one pending offer per order — flush expired/rejected first.
        if (customersDirty)
            await PersistAsync(cancellationToken);

        changed |= await ActivateNextQueuedOrFailAsync(order, offers, now, cancellationToken);
        return changed;
    }

    private async Task<bool> ActivateNextQueuedOrFailAsync(
        CustomerRentalOrder order,
        List<CustomerOrderVendorOffer> offers,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var queued = offers
            .Where(x => string.Equals(x.Status, SequentialDispatchRules.Queued, StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.OfferRank)
            .ToList();

        var ttl = SequentialDispatchRules.OfferTtl(options);
        foreach (var next in queued)
        {
            if (!await IsOfferStillEligibleAsync(order, next, cancellationToken))
            {
                next.Status = SequentialDispatchRules.Expired;
                next.RespondedAt = now;
                await customers.UpdateCustomerOrderVendorOfferAsync(next, cancellationToken);
                customersDirty = true;
                continue;
            }

            next.Status = SequentialDispatchRules.Pending;
            next.ExpiresAt = now.Add(ttl);
            next.RespondedAt = null;
            await customers.UpdateCustomerOrderVendorOfferAsync(next, cancellationToken);
            customersDirty = true;

            var title = await ResolveListingTitleAsync(order, cancellationToken);
            await NotifyVendorTurnAsync(next.VendorId, order, title, cancellationToken);
            return true;
        }

        await FailDispatchAsync(
            order,
            actorId: null,
            "No vendor accepted your order right now. Please retry checkout.",
            cancellationToken);
        return true;
    }

    public async Task FailDispatchAsync(
        CustomerRentalOrder order,
        Guid? actorId,
        string customerBody,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        await ExpireOpenOffersAsync(order.Id, now, cancellationToken);
        order.Status = "dispatch_failed";
        await CustomerOrderImageLifecycle.CloseAndPurgeForOrderAsync(
            customers, uploadStorage, order.Id, closedReason: "dispatch_failed", deletedBy: actorId, cancellationToken);
        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                Title = $"Order {order.OrderNumber} cancelled",
                Body = customerBody,
                NotificationType = "order_dispatch_failed",
                RelatedOrderId = order.Id,
            },
            cancellationToken);
        customersDirty = true;
    }

    private async Task ExpireOpenOffersAsync(Guid orderId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var offers = await customers.GetCustomerOrderVendorOffersAsync(orderId, cancellationToken);
        foreach (var offer in offers.Where(x => SequentialDispatchRules.IsOpenOffer(x.Status)))
        {
            offer.Status = SequentialDispatchRules.Expired;
            offer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(offer, cancellationToken);
            customersDirty = true;
        }
    }

    private async Task NotifyVendorTurnAsync(
        Guid vendorId,
        CustomerRentalOrder order,
        string listingTitle,
        CancellationToken cancellationToken)
    {
        await vendors.AddVendorNotificationAsync(
            new VendorNotification
            {
                VendorId = vendorId,
                NotificationType = "dispatch_offer",
                Title = $"New order request {order.OrderNumber}",
                Message = $"You have a new {order.OrderType} request for \"{listingTitle}\".",
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow,
            },
            cancellationToken);
        vendorsDirty = true;
    }

    private async Task<string> ResolveListingTitleAsync(CustomerRentalOrder order, CancellationToken cancellationToken)
    {
        var agg = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (agg is null)
            return "Listing";
        var title = agg.ListingTitle;
        if (order.ProductVariantId.HasValue && agg.Variants.Count > 0)
        {
            var variant = agg.Variants.FirstOrDefault(v =>
                string.Equals(v.Id, order.ProductVariantId.Value.ToString(), StringComparison.OrdinalIgnoreCase));
            if (variant is not null)
                title += $" ({Prilixor.VendorPortal.Application.Common.SizeFormatting.Format(variant.SizeValue, variant.SizeUnit)})";
        }

        return title;
    }

    private async Task<HashSet<Guid>> GetPreferredSiblingVendorIdsAsync(
        CustomerRentalOrder order,
        CancellationToken cancellationToken)
    {
        var siblings = await customers.GetSiblingCheckoutOrdersAsync(
            order.CustomerId, order.OrderNumber, order.Id, cancellationToken);
        var preferred = new HashSet<Guid>();
        foreach (var sibling in siblings.Where(s =>
                     string.Equals(s.Status, "confirmed", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(s.Status, "in_transit", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(s.Status, "active", StringComparison.OrdinalIgnoreCase)))
        {
            var listing = await customers.GetListingForCustomerAsync(sibling.VendorProductListingId, cancellationToken);
            if (listing is not null && listing.VendorId != Guid.Empty)
                preferred.Add(listing.VendorId);
        }

        return preferred;
    }

    private async Task<List<RankedDispatchCandidate>> RankEligibleAsync(
        CustomerRentalOrder order,
        Guid productId,
        IReadOnlySet<Guid> excludeVendorIds,
        IReadOnlySet<Guid> preferredVendorIds,
        CancellationToken cancellationToken)
    {
        CustomerAddress? address = null;
        var requiresAddress = CustomerOrderPricingRules.RequiresAddress(order.DeliveryOption);
        if (requiresAddress)
        {
            if (!order.CustomerAddressId.HasValue)
                return [];
            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, order.CustomerAddressId.Value, cancellationToken);
            if (address is null || !address.Latitude.HasValue || !address.Longitude.HasValue)
                return [];
        }

        var candidates = await customers.GetCandidateListingsByProductIdAsync(productId, cancellationToken);
        var eligible = new List<RankedDispatchCandidate>();
        var areasByVendor = new Dictionary<Guid, List<VendorServiceArea>>();

        foreach (var candidate in candidates.Where(c => c.VendorId != Guid.Empty))
        {
            if (excludeVendorIds.Contains(candidate.VendorId))
                continue;
            if (!HasStock(candidate, order))
                continue;

            decimal distanceKm = 0m;
            if (requiresAddress)
            {
                if (!areasByVendor.TryGetValue(candidate.VendorId, out var areas))
                {
                    areas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                    areasByVendor[candidate.VendorId] = areas;
                }

                var distance = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address!.Latitude!.Value,
                    address.Longitude!.Value,
                    candidate,
                    areas,
                    options,
                    enforceServiceRadius: order.PlacedByAdminId is null);
                if (!distance.IsSuccess)
                    continue;
                distanceKm = distance.DistanceKm;
            }

            eligible.Add(new RankedDispatchCandidate(
                candidate.VendorId,
                candidate.ListingId,
                distanceKm,
                StockForOrder(candidate, order)));
        }

        var pinFirstVendorId = (Guid?)null;
        if (order.PlacedByAdminId.HasValue)
        {
            var chosen = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
            if (chosen is not null && chosen.VendorId != Guid.Empty && !excludeVendorIds.Contains(chosen.VendorId))
                pinFirstVendorId = chosen.VendorId;
        }

        return SequentialDispatchRules.SelectUniqueVendors(
            eligible,
            excludeVendorIds,
            preferredVendorIds,
            SequentialDispatchRules.MaxVendors(options),
            pinFirstVendorId);
    }

    private async Task<bool> IsOfferStillEligibleAsync(
        CustomerRentalOrder order,
        CustomerOrderVendorOffer offer,
        CancellationToken cancellationToken)
    {
        var listing = await vendors.GetVendorProductListingByIdAsync(offer.VendorId, offer.VendorProductListingId, cancellationToken);
        if (listing is null)
            return false;

        if (order.ProductVariantId.HasValue)
        {
            var variantInv = await vendors.GetVariantInventoryByListingIdAsync(offer.VendorProductListingId, cancellationToken);
            var specific = variantInv.FirstOrDefault(vi => vi.ProductVariantId == order.ProductVariantId.Value);
            if ((specific?.AvailableQuantity ?? 0) < order.Quantity)
                return false;
        }
        else
        {
            var inventory = await vendors.GetVendorInventoryByListingIdAsync(offer.VendorProductListingId, cancellationToken);
            var available = inventory?.AvailableQuantity ?? listing.AvailableQuantity;
            if (available < order.Quantity)
                return false;
        }

        if (!CustomerOrderPricingRules.RequiresAddress(order.DeliveryOption))
            return true;
        if (!order.CustomerAddressId.HasValue)
            return false;

        var address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, order.CustomerAddressId.Value, cancellationToken);
        if (address is null || !address.Latitude.HasValue || !address.Longitude.HasValue)
            return false;

        var agg = await customers.GetListingForCustomerAsync(offer.VendorProductListingId, cancellationToken);
        if (agg is null)
            return false;
        var areas = await vendors.GetVendorServiceAreasAsync(offer.VendorId, cancellationToken);
        var distance = CustomerOrderPricingRules.ResolveDeliveryDistance(
            address.Latitude.Value,
            address.Longitude.Value,
            agg,
            areas,
            options,
            enforceServiceRadius: order.PlacedByAdminId is null);
        return distance.IsSuccess;
    }

    private static bool HasStock(VendorProductListingAggregate candidate, CustomerRentalOrder order) =>
        StockForOrder(candidate, order) >= order.Quantity;

    private static int StockForOrder(VendorProductListingAggregate candidate, CustomerRentalOrder order)
    {
        if (order.ProductVariantId.HasValue)
        {
            var specific = candidate.VariantInventory.FirstOrDefault(vi => vi.ProductVariantId == order.ProductVariantId.Value);
            return specific?.AvailableQuantity ?? 0;
        }

        return candidate.InventoryAvailable;
    }
}
