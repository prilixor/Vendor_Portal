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
    decimal TotalAmount,
    decimal GstPercent,
    int PendingDays = 0);

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

        var pending = await customers.GetPendingCustomerRentalOrderExtensionsAsync(order.Id, cancellationToken);
        var pendingDays = pending.Sum(x => x.AdditionalDays);
        var combinedDays = pendingDays + request.AdditionalDays;
        var dto = RentalExtensionQuote.Build(order, listingAggregate.DailyRent, combinedDays, pendingDays, options);

        return Result.Success(dto);
    }
}

public sealed record RequestExtensionCommand(Guid CustomerId, Guid OrderId, int AdditionalDays) : ICommand<Guid>;

internal sealed class RequestExtensionCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions,
    IMediator mediator)
    : ICommandHandler<RequestExtensionCommand, Guid>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<Guid>> Handle(RequestExtensionCommand request, CancellationToken cancellationToken)
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

        // In cash flow, no upfront payment intent check is required.
        // A later request updates the open pending row (1 day, then 3 more, becomes 4) instead of inserting another card.
        await PendingExtensionMerger.MergeDuplicatesForOrderAsync(customers, options, order.Id, cancellationToken);
        var pending = await customers.GetPendingCustomerRentalOrderExtensionsAsync(order.Id, cancellationToken);
        var keeper = pending.OrderBy(x => x.CreatedOnUtc).ThenBy(x => x.Id).FirstOrDefault();

        if (keeper is not null)
        {
            var combinedDays = keeper.AdditionalDays + request.AdditionalDays;
            RentalExtensionQuote.Apply(keeper, order, listingAggregate.DailyRent, combinedDays, options);
            await customers.UpdateCustomerRentalOrderExtensionAsync(keeper, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            await mediator.Send(new CreateVendorNotificationCommand(
                listingAggregate.VendorId.ToString(),
                "order_extension_requested",
                "Extension Updated",
                $"The customer updated the pending rental extension for order {order.OrderNumber} ({listingAggregate.ListingTitle}) to {combinedDays} days. Please review and approve this request. [ID: {order.Id}]",
                "push",
                "pending"
            ), cancellationToken);

            return Result.Success(keeper.Id);
        }

        var extension = new CustomerRentalOrderExtension
        {
            CustomerRentalOrderId = order.Id
        };
        RentalExtensionQuote.Apply(extension, order, listingAggregate.DailyRent, request.AdditionalDays, options);

        await customers.AddCustomerRentalOrderExtensionAsync(extension, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        
        // Notify the vendor
        var vendorNotificationCommand = new CreateVendorNotificationCommand(
            listingAggregate.VendorId.ToString(),
            "order_extension_requested",
            "Extension Requested",
            $"The customer has requested to extend the rental period for order {order.OrderNumber} ({listingAggregate.ListingTitle}) by {request.AdditionalDays} days. Please review and approve this request. [ID: {order.Id}]",
            "push",
            "pending"
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
    decimal TotalAmount,
    decimal GstPercent);

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
            totalAmount,
            options.GstPercent);

        return Result.Success(dto);
    }
}

public sealed record RequestBuyoutCommand(Guid CustomerId, Guid OrderId) : ICommand<Guid>;

internal sealed class RequestBuyoutCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IOptions<CustomerPricingOptions> pricingOptions,
    IMediator mediator)
    : ICommandHandler<RequestBuyoutCommand, Guid>
{
    private readonly CustomerPricingOptions options = pricingOptions.Value;

    public async Task<Result<Guid>> Handle(RequestBuyoutCommand request, CancellationToken cancellationToken)
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

        // In cash flow, no upfront payment intent check is required
        
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
            Status = "pending_approval"
        };
        
        await customers.AddCustomerRentalOrderBuyoutAsync(buyout, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        
        // Notify the vendor
        var vendorNotificationCommand = new CreateVendorNotificationCommand(
            listingAggregate.VendorId.ToString(),
            "order_buyout_requested",
            "Buyout Requested",
            $"The customer has requested to purchase the rented item for order {order.OrderNumber} ({listingAggregate.ListingTitle}). Please review and approve this request. [ID: {order.Id}]",
            "push",
            "pending"
        );
        await mediator.Send(vendorNotificationCommand, cancellationToken);
        
        return Result.Success(buyout.Id);
    }
}
public sealed record OrderContinuationsDto(
    List<PendingExtensionDto> PendingExtensions,
    List<PendingBuyoutDto> PendingBuyouts);

public sealed record PendingExtensionDto(
    Guid ExtensionId,
    Guid OrderId,
    int AdditionalDays,
    decimal ExtensionAmount,
    decimal ServiceFeeAmount,
    decimal GstAmount,
    decimal TotalAmount,
    DateOnly OriginalEndDate,
    DateOnly NewEndDate,
    DateTime CreatedAtUtc,
    decimal GstPercent);

public sealed record PendingBuyoutDto(
    Guid BuyoutId,
    Guid OrderId,
    decimal BaseBuyoutAmount,
    decimal RentDeductionAmount,
    decimal ServiceFeeAmount,
    decimal GstAmount,
    decimal TotalAmount,
    DateTime CreatedAtUtc,
    decimal GstPercent);

public sealed record GetOrderContinuationsQuery(Guid OrderId) : IQuery<OrderContinuationsDto>;

internal sealed class GetOrderContinuationsQueryHandler(
    ICustomerRepository customers,
    IOptions<CustomerPricingOptions> pricingOptions)
    : IQueryHandler<GetOrderContinuationsQuery, OrderContinuationsDto>
{
    public async Task<Result<OrderContinuationsDto>> Handle(GetOrderContinuationsQuery request, CancellationToken cancellationToken)
    {
        await PendingExtensionMerger.MergeDuplicatesForOrderAsync(customers, pricingOptions.Value, request.OrderId, cancellationToken);
        var extensions = await customers.GetPendingCustomerRentalOrderExtensionsAsync(request.OrderId, cancellationToken);
        var buyouts = await customers.GetPendingCustomerRentalOrderBuyoutsAsync(request.OrderId, cancellationToken);
        var gstPercent = pricingOptions.Value.GstPercent;

        var extensionsDto = extensions.Select(e => new PendingExtensionDto(
            e.Id, e.CustomerRentalOrderId, e.AdditionalDays, e.ExtensionAmount, e.ServiceFeeAmount, e.GstAmount, e.TotalAmount, e.OriginalEndDate, e.NewEndDate, e.CreatedOnUtc, gstPercent)).ToList();

        var buyoutsDto = buyouts.Select(b => new PendingBuyoutDto(
            b.Id, b.CustomerRentalOrderId, b.BaseBuyoutAmount, b.RentDeductionAmount, b.ServiceFeeAmount, b.GstAmount, b.TotalAmount, b.CreatedOnUtc, gstPercent)).ToList();

        return Result.Success(new OrderContinuationsDto(extensionsDto, buyoutsDto));
    }
}

internal static class RentalExtensionQuote
{
    public static ExtensionQuoteDto Build(
        CustomerRentalOrder order,
        decimal dailyRent,
        int additionalDays,
        int pendingDays,
        CustomerPricingOptions options)
    {
        var extensionAmount = dailyRent * order.Quantity * additionalDays;
        var serviceFeeAmount = options.ExtensionServiceFee;
        var subtotalForGst = extensionAmount + serviceFeeAmount;
        var gstAmount = subtotalForGst * (options.GstPercent / 100m);
        var totalAmount = subtotalForGst + gstAmount;
        var currentEndDate = order.EndDate ?? DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var newEndDate = currentEndDate.AddDays(additionalDays);

        return new ExtensionQuoteDto(
            order.Id,
            currentEndDate,
            newEndDate,
            additionalDays,
            extensionAmount,
            serviceFeeAmount,
            gstAmount,
            totalAmount,
            options.GstPercent,
            pendingDays);
    }

    public static void Apply(
        CustomerRentalOrderExtension extension,
        CustomerRentalOrder order,
        decimal dailyRent,
        int additionalDays,
        CustomerPricingOptions options)
    {
        var quote = Build(order, dailyRent, additionalDays, pendingDays: 0, options);
        extension.OriginalEndDate = quote.OriginalEndDate;
        extension.NewEndDate = quote.NewEndDate;
        extension.AdditionalDays = additionalDays;
        extension.ExtensionAmount = quote.ExtensionAmount;
        extension.ServiceFeeAmount = quote.ServiceFeeAmount;
        extension.GstAmount = quote.GstAmount;
        extension.TotalAmount = quote.TotalAmount;
        extension.Status = "pending_approval";
    }
}

internal static class PendingExtensionMerger
{
    public static async Task MergeDuplicatesForOrderAsync(
        ICustomerRepository customers,
        CustomerPricingOptions options,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        var pending = await customers.GetPendingCustomerRentalOrderExtensionsAsync(orderId, cancellationToken);
        if (pending.Count <= 1)
            return;

        var row = await customers.GetCustomerOrderByIdAsync(orderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return;

        var order = row.Order;
        var listing = await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
        if (listing is null)
            return;

        var keeper = pending.OrderBy(x => x.CreatedOnUtc).ThenBy(x => x.Id).First();
        var days = pending.Sum(x => x.AdditionalDays);
        if (days <= 0)
            return;

        RentalExtensionQuote.Apply(keeper, order, listing.DailyRent, days, options);
        await customers.UpdateCustomerRentalOrderExtensionAsync(keeper, cancellationToken);

        var removedAt = DateTimeOffset.UtcNow;
        foreach (var extra in pending)
        {
            if (extra.Id == keeper.Id)
                continue;

            extra.Status = "superseded";
            extra.IsDeleted = true;
            extra.DeletedAt = removedAt;
            await customers.UpdateCustomerRentalOrderExtensionAsync(extra, cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);
    }

    public static async Task MergeAllVisibleDuplicatesAsync(
        ICustomerRepository customers,
        CustomerPricingOptions options,
        CancellationToken cancellationToken)
    {
        var orderIds = await customers.GetOrderIdsWithDuplicatePendingExtensionsAsync(cancellationToken);
        foreach (var orderId in orderIds)
            await MergeDuplicatesForOrderAsync(customers, options, orderId, cancellationToken);
    }
}


