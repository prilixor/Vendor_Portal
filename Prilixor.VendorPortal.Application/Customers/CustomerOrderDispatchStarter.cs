using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

/// <summary>Shared vendor ranking + offer creation used at place-time and after payment capture.</summary>
internal static class CustomerOrderDispatchStarter
{
    public static async Task<List<(VendorProductListingAggregate Candidate, decimal DistanceKm)>> RankEligibleVendorsAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        CustomerPricingOptions options,
        CustomerRentalOrder order,
        Guid productId,
        Guid? productVariantId,
        CustomerAddress? address,
        Dictionary<Guid, List<VendorServiceArea>> vendorAreasByVendorId,
        CancellationToken cancellationToken)
    {
        var candidateListings = await customers.GetCandidateListingsByProductIdAsync(productId, cancellationToken);
        var eligibleCandidates = new List<(VendorProductListingAggregate Candidate, decimal DistanceKm)>();
        foreach (var candidate in candidateListings.Where(c => c.VendorId != Guid.Empty))
        {
            var candidateListing = await vendors.GetVendorProductListingByIdAsync(candidate.VendorId, candidate.ListingId, cancellationToken);
            if (candidateListing is null)
                continue;

            if (productVariantId.HasValue)
            {
                var variantInv = await vendors.GetVariantInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
                var specificVariant = variantInv.FirstOrDefault(vi => vi.ProductVariantId == productVariantId.Value);
                var varAvailable = specificVariant?.AvailableQuantity ?? 0;
                if (varAvailable < order.Quantity)
                    continue;
            }
            else
            {
                var candidateInventory = await vendors.GetVendorInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
                var candidateAvailable = candidateInventory?.AvailableQuantity ?? candidateListing.AvailableQuantity;
                if (candidateAvailable < order.Quantity)
                    continue;
            }

            decimal distanceKm = 0m;
            if (CustomerOrderPricingRules.RequiresAddress(order.DeliveryOption))
            {
                if (address is null || !address.Latitude.HasValue || !address.Longitude.HasValue)
                    continue;

                if (!vendorAreasByVendorId.TryGetValue(candidate.VendorId, out var vendorAreas))
                {
                    vendorAreas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                    vendorAreasByVendorId[candidate.VendorId] = vendorAreas;
                }

                var candidateDistance = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address.Latitude.Value,
                    address.Longitude.Value,
                    candidate,
                    vendorAreas,
                    options);
                if (!candidateDistance.IsSuccess)
                    continue;

                distanceKm = candidateDistance.DistanceKm;
            }

            eligibleCandidates.Add((candidate, distanceKm));
        }

        return eligibleCandidates
            .OrderBy(x => x.DistanceKm)
            .ThenByDescending(x => x.Candidate.InventoryAvailable)
            .Take(Math.Max(1, options.MaxDispatchVendorsPerLine))
            .ToList();
    }

    public static async Task CreateOffersAndNotifyAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        CustomerPricingOptions options,
        CustomerRentalOrder order,
        string listingTitle,
        string orderType,
        IReadOnlyList<(VendorProductListingAggregate Candidate, decimal DistanceKm)> ranked,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < ranked.Count; i++)
        {
            var candidate = ranked[i].Candidate;
            var offer = new CustomerOrderVendorOffer
            {
                CustomerRentalOrderId = order.Id,
                VendorId = candidate.VendorId,
                VendorProductListingId = candidate.ListingId,
                OfferRank = i + 1,
                Status = "pending",
                ExpiresAt = now.AddMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes)),
            };
            await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);

        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                Title = $"Order {order.OrderNumber} submitted",
                Body = $"Your {orderType} request for \"{listingTitle}\" is awaiting vendor acceptance.",
                NotificationType = "order_pending",
                RelatedOrderId = order.Id,
            },
            cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        foreach (var r in ranked)
        {
            var candidate = r.Candidate;
            await vendors.AddVendorNotificationAsync(new VendorNotification
            {
                VendorId = candidate.VendorId,
                NotificationType = "dispatch_offer",
                Title = $"New order request {order.OrderNumber}",
                Message = $"You have a new {orderType} request for \"{listingTitle}\".",
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow
            }, cancellationToken);
        }

        await vendors.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Moves awaiting_payment → awaiting_vendor_acceptance and creates dispatch offers.</summary>
    public static async Task<bool> ActivatePaidOrderAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        CustomerPricingOptions options,
        CustomerRentalOrder order,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(order.Status, "awaiting_payment", StringComparison.OrdinalIgnoreCase))
            return false;

        var agg = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (agg is null)
        {
            order.Status = "dispatch_failed";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return false;
        }

        CustomerAddress? address = null;
        if (order.CustomerAddressId is { } aid)
            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, aid, cancellationToken);

        var vendorAreasByVendorId = new Dictionary<Guid, List<VendorServiceArea>>();
        var ranked = await RankEligibleVendorsAsync(
            customers,
            vendors,
            options,
            order,
            agg.ProductId,
            order.ProductVariantId,
            address,
            vendorAreasByVendorId,
            cancellationToken);

        if (ranked.Count == 0)
        {
            order.Status = "dispatch_failed";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = order.CustomerId,
                    Title = $"Order {order.OrderNumber} dispatch failed",
                    Body = "Payment received, but no eligible vendor is available right now. Support will follow up.",
                    NotificationType = "order_dispatch_failed",
                    RelatedOrderId = order.Id,
                },
                cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return false;
        }

        order.Status = "awaiting_vendor_acceptance";
        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        var listingTitle = string.IsNullOrWhiteSpace(agg.ListingTitle) ? "item" : agg.ListingTitle;
        await CreateOffersAndNotifyAsync(
            customers,
            vendors,
            options,
            order,
            listingTitle,
            order.OrderType,
            ranked,
            cancellationToken);
        return true;
    }
}
