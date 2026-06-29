using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Microsoft.Extensions.Options;
using MediatR;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ExtensionQuoteDto(
    Guid OrderId,
    DateOnly OriginalEndDate,
    DateOnly NewEndDate,
    int AdditionalDays,
    decimal ExtensionAmount,
    decimal ServiceFeeAmount,
    decimal GstAmount,
    decimal TotalAmount);

public sealed record QuoteExtensionCommand(Guid CustomerId, Guid OrderId, int AdditionalDays) : ICommand<ExtensionQuoteDto>;

internal sealed class QuoteExtensionCommandHandler(
    ICustomerRepository customers,
    IOptions<CustomerPricingOptions> pricingOptions)
    : ICommandHandler<QuoteExtensionCommand, ExtensionQuoteDto>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<ExtensionQuoteDto>> Handle(QuoteExtensionCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<ExtensionQuoteDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = row.Order;
        if (!string.Equals(order.Status, "active", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ExtensionQuoteDto>(new Error("customers.order.not_active", "Only active orders can be extended.", ErrorCategory.Validation));
            
        if (!string.Equals(order.OrderType, "rent", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ExtensionQuoteDto>(new Error("customers.order.not_rental", "Only rental orders can be extended.", ErrorCategory.Validation));

        var listingAggregate = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listingAggregate is null)
            return Result.Failure<ExtensionQuoteDto>(new Error("customers.listing_not_found", "Product listing is no longer available.", ErrorCategory.NotFound));

        if (request.AdditionalDays <= 0)
            return Result.Failure<ExtensionQuoteDto>(new Error("customers.order.invalid_extension_days", "Additional days must be greater than zero.", ErrorCategory.Validation));

        var extensionAmount = listingAggregate.DailyRent * order.Quantity * request.AdditionalDays;
        var serviceFeeAmount = options.ExtensionServiceFee;
        var subtotalForGst = extensionAmount + serviceFeeAmount;
        var gstAmount = subtotalForGst * (options.GstPercent / 100m);
        var totalAmount = subtotalForGst + gstAmount;

        var currentEndDate = order.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newEndDate = currentEndDate.AddDays(request.AdditionalDays);

        var dto = new ExtensionQuoteDto(
            order.Id,
            currentEndDate,
            newEndDate,
            request.AdditionalDays,
            extensionAmount,
            serviceFeeAmount,
            gstAmount,
            totalAmount);

        return Result.Success(dto);
    }
}

public sealed record ProcessExtensionCommand(Guid CustomerId, Guid OrderId, int AdditionalDays, Guid PaymentIntentId) : ICommand<Guid>;

internal sealed class ProcessExtensionCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions,
    IMediator mediator)
    : ICommandHandler<ProcessExtensionCommand, Guid>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<Guid>> Handle(ProcessExtensionCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<Guid>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = row.Order;
        if (!string.Equals(order.Status, "active", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid>(new Error("customers.order.not_active", "Only active orders can be extended.", ErrorCategory.Validation));
            
        if (!string.Equals(order.OrderType, "rent", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid>(new Error("customers.order.not_rental", "Only rental orders can be extended.", ErrorCategory.Validation));

        var listingAggregate = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listingAggregate is null)
            return Result.Failure<Guid>(new Error("customers.listing_not_found", "Product listing is no longer available.", ErrorCategory.NotFound));

        if (request.AdditionalDays <= 0)
            return Result.Failure<Guid>(new Error("customers.order.invalid_extension_days", "Additional days must be greater than zero.", ErrorCategory.Validation));

        // In a real application, verify PaymentIntentId here before continuing.
        
        var extensionAmount = listingAggregate.DailyRent * order.Quantity * request.AdditionalDays;
        var serviceFeeAmount = options.ExtensionServiceFee;
        var subtotalForGst = extensionAmount + serviceFeeAmount;
        var gstAmount = subtotalForGst * (options.GstPercent / 100m);
        var totalAmount = subtotalForGst + gstAmount;

        var currentEndDate = order.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newEndDate = currentEndDate.AddDays(request.AdditionalDays);

        var extension = new CustomerRentalOrderExtension
        {
            CustomerRentalOrderId = order.Id,
            OriginalEndDate = currentEndDate,
            NewEndDate = newEndDate,
            AdditionalDays = request.AdditionalDays,
            ExtensionAmount = extensionAmount,
            ServiceFeeAmount = serviceFeeAmount,
            GstAmount = gstAmount,
            TotalAmount = totalAmount,
            Status = "paid"
        };
        
        await customers.AddCustomerRentalOrderExtensionAsync(extension, cancellationToken);

        // Update the original order's end date and financial totals
        order.EndDate = newEndDate;
        order.RentalDays += request.AdditionalDays;
        order.SubtotalAmount += extensionAmount;
        order.ServiceFeeAmount += serviceFeeAmount;
        order.GstAmount += gstAmount;
        order.TotalAmount += totalAmount;
        order.IsExtended = true;

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        
        // Notify the vendor
        var vendorNotificationCommand = new CreateVendorNotificationCommand(
            listingAggregate.VendorId.ToString(),
            "rental_extended",
            "Rental Extended",
            $"The rental period for order {order.OrderNumber} ({listingAggregate.ListingTitle}) has been extended by {request.AdditionalDays} days. New end date: {newEndDate.ToString("yyyy-MM-dd")}",
            "push",
            "sent"
        );
        await mediator.Send(vendorNotificationCommand, cancellationToken);
        
        return Result.Success(extension.Id);
    }
}

public sealed record BuyoutQuoteDto(
    Guid OrderId,
    decimal BaseBuyoutAmount,
    decimal RentDeductionAmount,
    decimal ServiceFeeAmount,
    decimal GstAmount,
    decimal TotalAmount);

public sealed record QuoteBuyoutCommand(Guid CustomerId, Guid OrderId) : ICommand<BuyoutQuoteDto>;

internal sealed class QuoteBuyoutCommandHandler(
    ICustomerRepository customers,
    IOptions<CustomerPricingOptions> pricingOptions)
    : ICommandHandler<QuoteBuyoutCommand, BuyoutQuoteDto>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<BuyoutQuoteDto>> Handle(QuoteBuyoutCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<BuyoutQuoteDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = row.Order;
        if (!string.Equals(order.Status, "active", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<BuyoutQuoteDto>(new Error("customers.order.not_active", "Only active orders can be bought out.", ErrorCategory.Validation));
            
        if (!string.Equals(order.OrderType, "rent", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<BuyoutQuoteDto>(new Error("customers.order.not_rental", "Only rental orders can be bought out.", ErrorCategory.Validation));

        var listingAggregate = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listingAggregate is null)
            return Result.Failure<BuyoutQuoteDto>(new Error("customers.listing_not_found", "Product listing is no longer available.", ErrorCategory.NotFound));

        if (!listingAggregate.IsBuyEnabled || listingAggregate.BuyPrice is null or <= 0)
            return Result.Failure<BuyoutQuoteDto>(new Error("customers.order.buyout_not_allowed", "This product is not available for buyout.", ErrorCategory.Validation));

        var baseBuyoutAmount = listingAggregate.BuyPrice.Value * order.Quantity;
        var rentDeductionAmount = order.SubtotalAmount * (options.BuyoutRentDeductionPercentage / 100m);
        // Ensure deduction does not exceed base buyout
        rentDeductionAmount = Math.Min(rentDeductionAmount, baseBuyoutAmount);
        
        var netBuyoutAmount = baseBuyoutAmount - rentDeductionAmount;
        
        var serviceFeeAmount = 0m; // No extra service fee for buyout by default, or could use BaseServiceFee
        var subtotalForGst = netBuyoutAmount + serviceFeeAmount;
        var gstAmount = subtotalForGst * (options.GstPercent / 100m);
        
        // Deposit from rental order could potentially be applied here, 
        // but for simplicity we calculate the raw amount needed to pay now.
        var totalAmount = subtotalForGst + gstAmount;

        var dto = new BuyoutQuoteDto(
            order.Id,
            baseBuyoutAmount,
            rentDeductionAmount,
            serviceFeeAmount,
            gstAmount,
            totalAmount);

        return Result.Success(dto);
    }
}

public sealed record ProcessBuyoutCommand(Guid CustomerId, Guid OrderId, Guid PaymentIntentId) : ICommand<Guid>;

internal sealed class ProcessBuyoutCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions,
    IMediator mediator)
    : ICommandHandler<ProcessBuyoutCommand, Guid>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<Guid>> Handle(ProcessBuyoutCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<Guid>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var order = row.Order;
        if (!string.Equals(order.Status, "active", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid>(new Error("customers.order.not_active", "Only active orders can be bought out.", ErrorCategory.Validation));
            
        if (!string.Equals(order.OrderType, "rent", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Guid>(new Error("customers.order.not_rental", "Only rental orders can be bought out.", ErrorCategory.Validation));

        var listingAggregate = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listingAggregate is null)
            return Result.Failure<Guid>(new Error("customers.listing_not_found", "Product listing is no longer available.", ErrorCategory.NotFound));

        if (!listingAggregate.IsBuyEnabled || listingAggregate.BuyPrice is null or <= 0)
            return Result.Failure<Guid>(new Error("customers.order.buyout_not_allowed", "This product is not available for buyout.", ErrorCategory.Validation));

        // In a real application, verify PaymentIntentId here before continuing.
        
        var baseBuyoutAmount = listingAggregate.BuyPrice.Value * order.Quantity;
        var rentDeductionAmount = order.SubtotalAmount * (options.BuyoutRentDeductionPercentage / 100m);
        rentDeductionAmount = Math.Min(rentDeductionAmount, baseBuyoutAmount);
        
        var netBuyoutAmount = baseBuyoutAmount - rentDeductionAmount;
        var serviceFeeAmount = 0m;
        var subtotalForGst = netBuyoutAmount + serviceFeeAmount;
        var gstAmount = subtotalForGst * (options.GstPercent / 100m);
        var totalAmount = subtotalForGst + gstAmount;

        var buyout = new CustomerRentalOrderBuyout
        {
            CustomerRentalOrderId = order.Id,
            BaseBuyoutAmount = baseBuyoutAmount,
            RentDeductionAmount = rentDeductionAmount,
            ServiceFeeAmount = serviceFeeAmount,
            GstAmount = gstAmount,
            TotalAmount = totalAmount,
            Status = "paid"
        };
        
        await customers.AddCustomerRentalOrderBuyoutAsync(buyout, cancellationToken);

        // Update the order status and financial totals
        order.Status = "bought_out";
        order.SubtotalAmount += netBuyoutAmount;
        order.ServiceFeeAmount += serviceFeeAmount;
        order.GstAmount += gstAmount;
        order.TotalAmount += totalAmount;

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        
        // We also need to remove these items from Vendor Inventory tracking.
        var inventory = await vendors.GetVendorInventoryByListingIdAsync(order.VendorProductListingId, cancellationToken);
        if (inventory is not null)
        {
            // Because they are bought out, they are permanently removed from TotalQuantity 
            // and we remove them from RentedQuantity since they are no longer rented.
            inventory.TotalQuantity = Math.Max(0, inventory.TotalQuantity - order.Quantity);
            inventory.RentedQuantity = Math.Max(0, inventory.RentedQuantity - order.Quantity);
            
            await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
            await vendors.AddVendorInventoryMovementAsync(
                new VendorInventoryMovement
                {
                    VendorInventoryId = inventory.Id,
                    MovementType = "stock_removed", // Treated as stock removed since it's bought out
                    Quantity = order.Quantity,
                    ReferenceType = "customer_rental_order_buyout",
                    ReferenceId = buyout.Id,
                    Notes = $"Order {order.OrderNumber} bought out by customer",
                    EventAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
        }
        else
        {
            // If inventory not tracked, we might not need to do anything, 
            // as available quantity was already decremented when the order was confirmed.
        }
        
        // Update asset statuses to 'sold' if they are tracked individually
        var assignedAssets = await customers.GetCustomerRentalOrderAssetsAsync(order.Id, cancellationToken);
        foreach (var orderAsset in assignedAssets)
        {
            var asset = await vendors.GetVendorProductAssetByIdAsync(orderAsset.VendorProductAssetId, cancellationToken);
            if (asset is not null)
            {
                asset.Status = "sold";
                await vendors.UpdateVendorProductAssetAsync(asset, cancellationToken);
            }
        }
        
        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);
        
        // Notify the vendor
        var vendorNotificationCommand = new CreateVendorNotificationCommand(
            listingAggregate.VendorId.ToString(),
            "rental_bought_out",
            "Item Purchased",
            $"The customer has purchased the rented item for order {order.OrderNumber} ({listingAggregate.ListingTitle}). You do not need to retrieve it.",
            "push",
            "sent"
        );
        await mediator.Send(vendorNotificationCommand, cancellationToken);
        
        return Result.Success(buyout.Id);
    }
}
