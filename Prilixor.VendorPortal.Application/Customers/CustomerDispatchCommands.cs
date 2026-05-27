using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Microsoft.Extensions.Options;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record VendorDispatchOfferDto(
    Guid OfferId,
    Guid OrderId,
    string OrderNumber,
    Guid ListingId,
    string ListingTitle,
    string OrderType,
    int Quantity,
    int RentalDays,
    DateTimeOffset ExpiresAt,
    string Status,
    decimal TotalAmount,
    DateOnly? StartDate,
    DateOnly? EndDate);

public sealed record GetVendorPendingDispatchOffersQuery(string VendorId) : IQuery<List<VendorDispatchOfferDto>>;

internal sealed class GetVendorPendingDispatchOffersQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorPendingDispatchOffersQuery, List<VendorDispatchOfferDto>>
{
    public async Task<Result<List<VendorDispatchOfferDto>>> Handle(GetVendorPendingDispatchOffersQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<List<VendorDispatchOfferDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var offers = await customers.GetPendingVendorOffersAsync(vendorId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var result = new List<VendorDispatchOfferDto>();

        foreach (var offer in offers)
        {
            if (offer.ExpiresAt <= now)
            {
                offer.Status = "expired";
                offer.RespondedAt = now;
                await customers.UpdateCustomerOrderVendorOfferAsync(offer, cancellationToken);
                continue;
            }

            var order = await customers.GetCustomerOrderEntityByIdAsync(offer.CustomerRentalOrderId, cancellationToken);
            if (order is null)
                continue;

            var listing = await vendors.GetVendorProductListingByIdAsync(vendorId, offer.VendorProductListingId, cancellationToken);
            var title = listing?.ListingTitle ?? "Listing";

            result.Add(new VendorDispatchOfferDto(
                offer.Id,
                order.Id,
                order.OrderNumber,
                offer.VendorProductListingId,
                title,
                order.OrderType,
                order.Quantity,
                order.RentalDays,
                offer.ExpiresAt,
                offer.Status,
                order.TotalAmount,
                order.StartDate,
                order.EndDate));
        }

        await customers.SaveChangesAsync(cancellationToken);
        return Result.Success(result.OrderBy(x => x.ExpiresAt).ToList());
    }
}

public sealed record VendorRespondDispatchOfferCommand(string VendorId, Guid OrderId, string Action) : ICommand<CustomerOrderDto>;

internal sealed class VendorRespondDispatchOfferCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<VendorRespondDispatchOfferCommand, CustomerOrderDto>
{
    public async Task<Result<CustomerOrderDto>> Handle(VendorRespondDispatchOfferCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<CustomerOrderDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var action = request.Action.Trim().ToLowerInvariant();
        if (action is not ("accept" or "reject"))
            return Result.Failure<CustomerOrderDto>(new Error("vendors.dispatch.invalid_action", "Action must be accept or reject.", ErrorCategory.Validation));

        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.IsDeleted)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!string.Equals(order.Status, "awaiting_vendor_acceptance", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<CustomerOrderDto>(new Error("vendors.dispatch.invalid_status", "Order is not awaiting vendor acceptance.", ErrorCategory.Validation));

        var offers = await customers.GetCustomerOrderVendorOffersAsync(order.Id, cancellationToken);
        var myOffer = offers.FirstOrDefault(x => x.VendorId == vendorId && x.Status == "pending");
        if (myOffer is null)
            return Result.Failure<CustomerOrderDto>(new Error("vendors.dispatch.offer_not_found", "No pending offer found for this vendor.", ErrorCategory.NotFound));

        var now = DateTimeOffset.UtcNow;
        if (myOffer.ExpiresAt <= now)
        {
            myOffer.Status = "expired";
            myOffer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(myOffer, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Failure<CustomerOrderDto>(new Error("vendors.dispatch.offer_expired", "Offer has expired.", ErrorCategory.Validation));
        }

        if (action == "reject")
        {
            myOffer.Status = "rejected";
            myOffer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(myOffer, cancellationToken);

            var nextPending = offers
                .Where(x => x.Id != myOffer.Id && x.Status == "pending" && x.ExpiresAt > now)
                .OrderBy(x => x.OfferRank)
                .FirstOrDefault();

            if (nextPending is null)
            {
                order.Status = "dispatch_failed";
                await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
                await customers.AddCustomerNotificationAsync(
                    new CustomerNotification
                    {
                        Id = Guid.NewGuid(),
                        CustomerId = order.CustomerId,
                        Title = $"Order {order.OrderNumber} dispatch failed",
                        Body = "No vendor accepted your order right now. Please retry checkout.",
                        NotificationType = "order_dispatch_failed",
                        RelatedOrderId = order.Id,
                    },
                    cancellationToken);
            }
            else
            {
                await NotifyVendorDispatchOfferAsync(vendors, order, nextPending, cancellationToken);
            }

            await customers.SaveChangesAsync(cancellationToken);
            await vendors.SaveChangesAsync(cancellationToken);
            return await BuildOrderDto(customers, request.OrderId, cancellationToken);
        }

        var selectedListing = await vendors.GetVendorProductListingByIdAsync(vendorId, myOffer.VendorProductListingId, cancellationToken);
        if (selectedListing is null)
            return Result.Failure<CustomerOrderDto>(new Error("vendors.listing.not_found", "Vendor listing not found.", ErrorCategory.NotFound));

        var selectedInventory = await vendors.GetVendorInventoryByListingIdAsync(selectedListing.Id, cancellationToken);
        var available = selectedInventory?.AvailableQuantity ?? selectedListing.AvailableQuantity;
        if (available < order.Quantity)
            return Result.Failure<CustomerOrderDto>(new Error("vendors.inventory.insufficient", "Insufficient stock to accept this order.", ErrorCategory.Validation));

        order.VendorProductListingId = selectedListing.Id;
        order.Status = "confirmed";
        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);

        myOffer.Status = "accepted";
        myOffer.RespondedAt = now;
        await customers.UpdateCustomerOrderVendorOfferAsync(myOffer, cancellationToken);

        foreach (var offer in offers.Where(x => x.Id != myOffer.Id && x.Status == "pending"))
        {
            offer.Status = "expired";
            offer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        if (selectedInventory is not null)
        {
            selectedInventory.AvailableQuantity -= order.Quantity;
            selectedInventory.ReservedQuantity += order.Quantity;
            await vendors.UpsertVendorInventoryAsync(selectedInventory, cancellationToken);
            await vendors.AddVendorInventoryMovementAsync(
                new VendorInventoryMovement
                {
                    VendorInventoryId = selectedInventory.Id,
                    MovementType = "reserved",
                    Quantity = order.Quantity,
                    ReferenceType = "customer_rental_order",
                    ReferenceId = order.Id,
                    Notes = $"Dispatch accepted for {order.OrderNumber}",
                    EventAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
        }
        else
        {
            selectedListing.AvailableQuantity -= order.Quantity;
            await vendors.UpdateVendorProductListingAsync(selectedListing, cancellationToken);
        }

        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                Title = $"Order {order.OrderNumber} confirmed",
                Body = "Your order has been accepted by a nearby vendor.",
                NotificationType = "order_confirmed",
                RelatedOrderId = order.Id,
            },
            cancellationToken);

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await BuildOrderDto(customers, request.OrderId, cancellationToken);
    }

    private static Task NotifyVendorDispatchOfferAsync(
        IVendorOnboardingRepository vendors,
        CustomerRentalOrder order,
        CustomerOrderVendorOffer offer,
        CancellationToken cancellationToken) =>
        vendors.AddVendorNotificationAsync(
            new VendorNotification
            {
                VendorId = offer.VendorId,
                NotificationType = "dispatch_offer",
                Title = $"New order request {order.OrderNumber}",
                Message = $"You have a new {order.OrderType} request for order {order.OrderNumber}.",
                Channel = "in_app",
                Status = "sent",
                SentAt = DateTimeOffset.UtcNow,
            },
            cancellationToken);

    internal static async Task<Result<CustomerOrderDto>> BuildOrderDto(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var o = row.Order;
        var listing = row.Listing;
        var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
        var title = listing?.ListingTitle ?? "Listing unavailable";

        return Result.Success(new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            title,
            vendorName ?? "Vendor",
            CustomerOrderStatusMapper.ToDisplay(o.Status),
            o.StartDate,
            o.EndDate,
            o.TotalAmount,
            o.DepositAmount,
            o.ServiceFeeAmount,
            o.DistanceFeeAmount,
            o.ExpressFeeAmount,
            o.GstAmount,
            o.OrderType,
            o.Quantity,
            o.RentalDays,
            row.ListingPrimaryImageUrl));
    }
}

public sealed record VendorCancelAssignedOrderCommand(string VendorId, Guid OrderId) : ICommand<CustomerOrderDto>;

internal sealed class VendorCancelAssignedOrderCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions)
    : ICommandHandler<VendorCancelAssignedOrderCommand, CustomerOrderDto>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<CustomerOrderDto>> Handle(VendorCancelAssignedOrderCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<CustomerOrderDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.IsDeleted)
            return Result.Failure<CustomerOrderDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var currentListing = await vendors.GetVendorProductListingByIdAsync(vendorId, order.VendorProductListingId, cancellationToken);
        if (currentListing is null)
            return Result.Failure<CustomerOrderDto>(new Error("vendors.order_not_owned", "This order is not assigned to the vendor.", ErrorCategory.Validation));

        if (!string.Equals(order.Status, "confirmed", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<CustomerOrderDto>(new Error("vendors.dispatch.invalid_status", "Only confirmed orders can be cancelled by vendor.", ErrorCategory.Validation));

        var inventory = await vendors.GetVendorInventoryByListingIdAsync(currentListing.Id, cancellationToken);
        if (inventory is not null)
        {
            inventory.ReservedQuantity = Math.Max(0, inventory.ReservedQuantity - order.Quantity);
            inventory.AvailableQuantity += order.Quantity;
            await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
            await vendors.AddVendorInventoryMovementAsync(
                new VendorInventoryMovement
                {
                    VendorInventoryId = inventory.Id,
                    MovementType = "released",
                    Quantity = order.Quantity,
                    ReferenceType = "customer_rental_order",
                    ReferenceId = order.Id,
                    Notes = $"Released due to vendor cancellation for {order.OrderNumber}",
                    EventAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
        }
        else
        {
            currentListing.AvailableQuantity += order.Quantity;
            await vendors.UpdateVendorProductListingAsync(currentListing, cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var existingOffers = await customers.GetCustomerOrderVendorOffersAsync(order.Id, cancellationToken);
        foreach (var offer in existingOffers.Where(x => x.VendorId == vendorId && x.Status is "accepted" or "pending"))
        {
            offer.Status = "rejected";
            offer.RespondedAt = now;
            await customers.UpdateCustomerOrderVendorOfferAsync(offer, cancellationToken);
        }

        var pending = existingOffers
            .Where(x => x.VendorId != vendorId && x.Status == "pending" && x.ExpiresAt > now)
            .OrderBy(x => x.OfferRank)
            .ToList();

        if (pending.Count == 0)
        {
            pending = await CreateFallbackOffersAsync(order, vendorId, cancellationToken);
        }

        if (pending.Count == 0)
        {
            order.Status = "dispatch_failed";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = order.CustomerId,
                    Title = $"Order {order.OrderNumber} needs re-booking",
                    Body = "Vendor cancelled this item and no replacement vendor is currently available.",
                    NotificationType = "order_dispatch_failed",
                    RelatedOrderId = order.Id,
                },
                cancellationToken);
        }
        else
        {
            order.Status = "awaiting_vendor_acceptance";
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            var next = pending[0];
            await vendors.AddVendorNotificationAsync(
                new VendorNotification
                {
                    VendorId = next.VendorId,
                    NotificationType = "dispatch_offer",
                    Title = $"New order request {order.OrderNumber}",
                    Message = $"Vendor cancelled previous assignment. Please accept order {order.OrderNumber}.",
                    Channel = "in_app",
                    Status = "sent",
                    SentAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = order.CustomerId,
                    Title = $"Order {order.OrderNumber} is being reassigned",
                    Body = "One vendor cancelled this item. We are notifying another nearby vendor.",
                    NotificationType = "order_pending",
                    RelatedOrderId = order.Id,
                },
                cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return await VendorRespondDispatchOfferCommandHandler.BuildOrderDto(customers, order.Id, cancellationToken);
    }

    private async Task<List<CustomerOrderVendorOffer>> CreateFallbackOffersAsync(
        CustomerRentalOrder order,
        Guid excludedVendorId,
        CancellationToken cancellationToken)
    {
        var baseListing = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (baseListing is null || baseListing.ProductId == Guid.Empty)
            return [];

        CustomerAddress? address = null;
        if (CustomerOrderPricingRules.RequiresAddress(order.DeliveryOption))
        {
            if (!order.CustomerAddressId.HasValue)
                return [];

            address = await customers.GetCustomerAddressByIdAsync(order.CustomerId, order.CustomerAddressId.Value, cancellationToken);
            if (address is null || !address.Latitude.HasValue || !address.Longitude.HasValue)
                return [];
        }

        var candidates = await customers.GetCandidateListingsByProductIdAsync(baseListing.ProductId, cancellationToken);
        var ranked = new List<(VendorProductListingAggregate candidate, decimal distanceKm)>();
        foreach (var candidate in candidates.Where(c => c.VendorId != excludedVendorId))
        {
            var listing = await vendors.GetVendorProductListingByIdAsync(candidate.VendorId, candidate.ListingId, cancellationToken);
            if (listing is null)
                continue;

            var inv = await vendors.GetVendorInventoryByListingIdAsync(candidate.ListingId, cancellationToken);
            var available = inv?.AvailableQuantity ?? listing.AvailableQuantity;
            if (available < order.Quantity)
                continue;

            var distance = 0m;
            if (address is not null)
            {
                var areas = await vendors.GetVendorServiceAreasAsync(candidate.VendorId, cancellationToken);
                var distanceResult = CustomerOrderPricingRules.ResolveDeliveryDistance(
                    address.Latitude!.Value,
                    address.Longitude!.Value,
                    candidate,
                    areas,
                    options);
                if (!distanceResult.IsSuccess)
                    continue;

                distance = distanceResult.DistanceKm;
            }

            ranked.Add((candidate, distance));
        }

        var selected = ranked
            .OrderBy(x => x.distanceKm)
            .ThenByDescending(x => x.candidate.InventoryAvailable)
            .Take(Math.Max(1, options.MaxDispatchVendorsPerLine))
            .ToList();

        if (selected.Count == 0)
            return [];

        var now = DateTimeOffset.UtcNow;
        var created = new List<CustomerOrderVendorOffer>(selected.Count);
        for (var i = 0; i < selected.Count; i++)
        {
            var offer = new CustomerOrderVendorOffer
            {
                CustomerRentalOrderId = order.Id,
                VendorId = selected[i].candidate.VendorId,
                VendorProductListingId = selected[i].candidate.ListingId,
                OfferRank = i + 1,
                Status = "pending",
                ExpiresAt = now.AddMinutes((double)Math.Max(1m, options.DispatchOfferTtlMinutes)),
            };
            await customers.AddCustomerOrderVendorOfferAsync(offer, cancellationToken);
            created.Add(offer);
        }

        return created;
    }
}
