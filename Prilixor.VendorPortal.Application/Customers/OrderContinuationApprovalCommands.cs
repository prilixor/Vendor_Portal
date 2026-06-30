using MediatR;
using Microsoft.Extensions.Options;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ApproveExtensionCommand(
    Guid OrderId,
    Guid ExtensionId,
    Guid ApproverId,
    string ApproverType, // "admin" or "vendor"
    int? OverrideAdditionalDays = null,
    decimal? OverrideExtensionAmount = null,
    decimal? OverrideServiceFeeAmount = null,
    decimal? OverrideGstAmount = null,
    decimal? OverrideTotalAmount = null) : ICommand<bool>;

internal sealed class ApproveExtensionCommandHandler(
    ICustomerRepository customers,
    IMediator mediator) : ICommandHandler<ApproveExtensionCommand, bool>
{
    public async Task<Result<bool>> Handle(ApproveExtensionCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<bool>(new Error("orders.not_found", "Order not found", ErrorCategory.NotFound));
            
        var order = row.Order;
        
        var extension = await customers.GetCustomerRentalOrderExtensionByIdAsync(request.ExtensionId, cancellationToken);
        if (extension is null || extension.CustomerRentalOrderId != request.OrderId)
            return Result.Failure<bool>(new Error("extensions.not_found", "Extension request not found", ErrorCategory.NotFound));
            
        if (extension.Status != "pending_approval")
            return Result.Failure<bool>(new Error("extensions.not_pending", "Extension is not pending approval", ErrorCategory.Validation));

        // Apply overrides if provided
        if (request.OverrideAdditionalDays.HasValue)
        {
            extension.AdditionalDays = request.OverrideAdditionalDays.Value;
            extension.NewEndDate = extension.OriginalEndDate.AddDays(extension.AdditionalDays);
        }
        if (request.OverrideExtensionAmount.HasValue) extension.ExtensionAmount = request.OverrideExtensionAmount.Value;
        if (request.OverrideServiceFeeAmount.HasValue) extension.ServiceFeeAmount = request.OverrideServiceFeeAmount.Value;
        if (request.OverrideGstAmount.HasValue) extension.GstAmount = request.OverrideGstAmount.Value;
        if (request.OverrideTotalAmount.HasValue) extension.TotalAmount = request.OverrideTotalAmount.Value;

        extension.Status = "paid"; // In cash flow, approval implies settlement

        await customers.UpdateCustomerRentalOrderExtensionAsync(extension, cancellationToken);

        // Update Order
        order.EndDate = extension.NewEndDate;
        order.RentalDays += extension.AdditionalDays;
        order.SubtotalAmount += extension.ExtensionAmount;
        order.ServiceFeeAmount += extension.ServiceFeeAmount;
        order.GstAmount += extension.GstAmount;
        order.TotalAmount += extension.TotalAmount;
        order.IsExtended = true;

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        // Notify Customer
        await mediator.Send(new CreateCustomerNotificationCommand(
            order.CustomerId,
            "customer_extension_approved",
            "Extension Approved",
            $"Your request to extend order {order.OrderNumber} has been approved by the {request.ApproverType}.",
            order.Id
        ), cancellationToken);

        return Result.Success(true);
    }
}

public sealed record CancelExtensionCommand(
    Guid OrderId,
    Guid ExtensionId,
    Guid ApproverId,
    string ApproverType) : ICommand<bool>;

internal sealed class CancelExtensionCommandHandler(
    ICustomerRepository customers,
    IMediator mediator) : ICommandHandler<CancelExtensionCommand, bool>
{
    public async Task<Result<bool>> Handle(CancelExtensionCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<bool>(new Error("orders.not_found", "Order not found", ErrorCategory.NotFound));
            
        var order = row.Order;
        
        var extension = await customers.GetCustomerRentalOrderExtensionByIdAsync(request.ExtensionId, cancellationToken);
        if (extension is null || extension.CustomerRentalOrderId != request.OrderId)
            return Result.Failure<bool>(new Error("extensions.not_found", "Extension request not found", ErrorCategory.NotFound));
            
        if (extension.Status != "pending_approval")
            return Result.Failure<bool>(new Error("extensions.not_pending", "Extension is not pending approval", ErrorCategory.Validation));

        extension.Status = "cancelled";

        await customers.UpdateCustomerRentalOrderExtensionAsync(extension, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        // Notify Customer
        await mediator.Send(new CreateCustomerNotificationCommand(
            order.CustomerId,
            "customer_extension_cancelled",
            "Extension Cancelled",
            $"Your request to extend order {order.OrderNumber} has been cancelled by the {request.ApproverType}.",
            order.Id
        ), cancellationToken);

        return Result.Success(true);
    }
}

public sealed record ApproveBuyoutCommand(
    Guid OrderId,
    Guid BuyoutId,
    Guid ApproverId,
    string ApproverType,
    decimal? OverrideBaseBuyoutAmount = null,
    decimal? OverrideRentDeductionAmount = null,
    decimal? OverrideServiceFeeAmount = null,
    decimal? OverrideGstAmount = null,
    decimal? OverrideTotalAmount = null) : ICommand<bool>;

internal sealed class ApproveBuyoutCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IMediator mediator) : ICommandHandler<ApproveBuyoutCommand, bool>
{
    public async Task<Result<bool>> Handle(ApproveBuyoutCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<bool>(new Error("orders.not_found", "Order not found", ErrorCategory.NotFound));
            
        var order = row.Order;
        
        var buyout = await customers.GetCustomerRentalOrderBuyoutByIdAsync(request.BuyoutId, cancellationToken);
        if (buyout is null || buyout.CustomerRentalOrderId != request.OrderId)
            return Result.Failure<bool>(new Error("buyouts.not_found", "Buyout request not found", ErrorCategory.NotFound));
            
        if (buyout.Status != "pending_approval")
            return Result.Failure<bool>(new Error("buyouts.not_pending", "Buyout is not pending approval", ErrorCategory.Validation));

        // Apply overrides if provided
        if (request.OverrideBaseBuyoutAmount.HasValue) buyout.BaseBuyoutAmount = request.OverrideBaseBuyoutAmount.Value;
        if (request.OverrideRentDeductionAmount.HasValue) buyout.RentDeductionAmount = request.OverrideRentDeductionAmount.Value;
        if (request.OverrideServiceFeeAmount.HasValue) buyout.ServiceFeeAmount = request.OverrideServiceFeeAmount.Value;
        if (request.OverrideGstAmount.HasValue) buyout.GstAmount = request.OverrideGstAmount.Value;
        if (request.OverrideTotalAmount.HasValue) buyout.TotalAmount = request.OverrideTotalAmount.Value;

        buyout.Status = "paid"; // In cash flow, approval implies settlement

        await customers.UpdateCustomerRentalOrderBuyoutAsync(buyout, cancellationToken);

        // Update Order
        var netBuyoutAmount = buyout.BaseBuyoutAmount - buyout.RentDeductionAmount;
        order.Status = "bought_out";
        order.SubtotalAmount += netBuyoutAmount;
        order.ServiceFeeAmount += buyout.ServiceFeeAmount;
        order.GstAmount += buyout.GstAmount;
        order.TotalAmount += buyout.TotalAmount;

        await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
        
        // Update Inventory & Assets
        var inventory = await vendors.GetVendorInventoryByListingIdAsync(order.VendorProductListingId, cancellationToken);
        if (inventory is not null)
        {
            inventory.TotalQuantity = Math.Max(0, inventory.TotalQuantity - order.Quantity);
            inventory.RentedQuantity = Math.Max(0, inventory.RentedQuantity - order.Quantity);
            
            await vendors.UpsertVendorInventoryAsync(inventory, cancellationToken);
            await vendors.AddVendorInventoryMovementAsync(
                new Prilixor.VendorPortal.Domain.Vendors.VendorInventoryMovement
                {
                    VendorInventoryId = inventory.Id,
                    MovementType = "stock_removed",
                    Quantity = order.Quantity,
                    ReferenceType = "customer_rental_order_buyout",
                    ReferenceId = buyout.Id,
                    Notes = $"Order {order.OrderNumber} buyout approved",
                    EventAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
        }

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

        // Notify Customer
        await mediator.Send(new CreateCustomerNotificationCommand(
            order.CustomerId,
            "customer_buyout_approved",
            "Buyout Approved",
            $"Your request to purchase rented order {order.OrderNumber} has been approved by the {request.ApproverType}.",
            order.Id
        ), cancellationToken);

        return Result.Success(true);
    }
}

public sealed record CancelBuyoutCommand(
    Guid OrderId,
    Guid BuyoutId,
    Guid ApproverId,
    string ApproverType) : ICommand<bool>;

internal sealed class CancelBuyoutCommandHandler(
    ICustomerRepository customers,
    IMediator mediator) : ICommandHandler<CancelBuyoutCommand, bool>
{
    public async Task<Result<bool>> Handle(CancelBuyoutCommand request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderByIdAsync(request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<bool>(new Error("orders.not_found", "Order not found", ErrorCategory.NotFound));
            
        var order = row.Order;
        
        var buyout = await customers.GetCustomerRentalOrderBuyoutByIdAsync(request.BuyoutId, cancellationToken);
        if (buyout is null || buyout.CustomerRentalOrderId != request.OrderId)
            return Result.Failure<bool>(new Error("buyouts.not_found", "Buyout request not found", ErrorCategory.NotFound));
            
        if (buyout.Status != "pending_approval")
            return Result.Failure<bool>(new Error("buyouts.not_pending", "Buyout is not pending approval", ErrorCategory.Validation));

        buyout.Status = "cancelled";

        await customers.UpdateCustomerRentalOrderBuyoutAsync(buyout, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        // Notify Customer
        await mediator.Send(new CreateCustomerNotificationCommand(
            order.CustomerId,
            "customer_buyout_cancelled",
            "Buyout Cancelled",
            $"Your request to purchase rented order {order.OrderNumber} has been cancelled by the {request.ApproverType}.",
            order.Id
        ), cancellationToken);

        return Result.Success(true);
    }
}
