using System.Globalization;
using MediatR;
using Microsoft.Extensions.Logging;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Application.Customers;

public static class RentalExtensionStatuses
{
    public const string PendingApproval = "pending_approval";
    public const string AwaitingPayment = "awaiting_payment";
    public const string Paid = "paid";
}

internal static class ExtensionPaymentReceipt
{
    public static string For(Guid extensionId) => $"ext_{extensionId:N}";

    public static bool TryParse(string? receipt, out Guid extensionId)
    {
        extensionId = Guid.Empty;
        if (string.IsNullOrWhiteSpace(receipt) || !receipt.StartsWith("ext_", StringComparison.Ordinal) || receipt.Length != 36)
            return false;

        return Guid.TryParseExact(receipt[4..], "N", out extensionId);
    }
}

internal static class RentalExtensionGuard
{
    public static async Task<Error?> PaymentDueAsync(ICustomerRepository customers, Guid orderId, CancellationToken cancellationToken)
    {
        var rows = await customers.GetCustomerExtensionHistoryAsync(orderId, cancellationToken);
        if (rows.Any(x => string.Equals(x.Status, RentalExtensionStatuses.AwaitingPayment, StringComparison.OrdinalIgnoreCase)))
        {
            return new Error(
                "customers.extension_payment_due",
                "Pay the approved extension on this product before requesting more days.",
                ErrorCategory.Validation);
        }

        return null;
    }
}

public sealed record CustomerExtensionHistoryDto(
    Guid ExtensionId,
    string Status,
    int AdditionalDays,
    decimal ExtensionAmount,
    decimal ServiceFeeAmount,
    decimal GstAmount,
    decimal TotalAmount,
    DateOnly OriginalEndDate,
    DateOnly NewEndDate,
    decimal GstPercent);

public sealed record GetCustomerExtensionHistoryQuery(Guid CustomerId, Guid OrderId) : IQuery<List<CustomerExtensionHistoryDto>>;

internal sealed class GetCustomerExtensionHistoryQueryHandler(
    ICustomerRepository customers,
    Microsoft.Extensions.Options.IOptions<CustomerPricingOptions> pricingOptions)
    : IQueryHandler<GetCustomerExtensionHistoryQuery, List<CustomerExtensionHistoryDto>>
{
    public async Task<Result<List<CustomerExtensionHistoryDto>>> Handle(GetCustomerExtensionHistoryQuery request, CancellationToken cancellationToken)
    {
        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<List<CustomerExtensionHistoryDto>>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        await PendingExtensionFeeSync.ApplyAsync(customers, pricingOptions.Value, request.OrderId, cancellationToken);
        var gstPercent = pricingOptions.Value.GstPercent;
        var rows = await customers.GetCustomerExtensionHistoryAsync(request.OrderId, cancellationToken);
        var dtos = rows.Select(e => new CustomerExtensionHistoryDto(
            e.Id,
            e.Status,
            e.AdditionalDays,
            e.ExtensionAmount,
            e.ServiceFeeAmount,
            e.GstAmount,
            e.TotalAmount,
            e.OriginalEndDate,
            e.NewEndDate,
            gstPercent)).ToList();

        return Result.Success(dtos);
    }
}

public sealed record ExtensionPaymentDto(
    Guid CheckoutSessionId,
    string RazorpayKeyId,
    string? RazorpayOrderId,
    decimal Amount,
    string Currency,
    Guid ExtensionId,
    Guid OrderId);

public sealed record StartExtensionPaymentCommand(Guid CustomerId, Guid OrderId, Guid ExtensionId) : ICommand<ExtensionPaymentDto>;

internal sealed class StartExtensionPaymentCommandHandler(
    ICustomerRepository customers,
    IRazorpayPaymentService razorpay,
    ILogger<StartExtensionPaymentCommandHandler> logger) : ICommandHandler<StartExtensionPaymentCommand, ExtensionPaymentDto>
{
    public async Task<Result<ExtensionPaymentDto>> Handle(StartExtensionPaymentCommand request, CancellationToken cancellationToken)
    {
        if (!razorpay.IsConfigured)
        {
            return Result.Failure<ExtensionPaymentDto>(new Error(
                "payments.razorpay_not_configured",
                "Payment gateway is not configured. Contact support.",
                ErrorCategory.Validation));
        }

        var row = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (row is null || row.Order.IsDeleted)
            return Result.Failure<ExtensionPaymentDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        var extension = await customers.GetCustomerRentalOrderExtensionByIdAsync(request.ExtensionId, cancellationToken);
        if (extension is null || extension.CustomerRentalOrderId != request.OrderId)
            return Result.Failure<ExtensionPaymentDto>(new Error("extensions.not_found", "Extension request not found.", ErrorCategory.NotFound));

        if (string.Equals(extension.Status, RentalExtensionStatuses.Paid, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ExtensionPaymentDto>(new Error("extensions.already_paid", "This extension is already paid.", ErrorCategory.Validation));

        if (!string.Equals(extension.Status, RentalExtensionStatuses.AwaitingPayment, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<ExtensionPaymentDto>(new Error("extensions.not_payable", "This extension is not ready for payment.", ErrorCategory.Validation));

        var amountPaise = (long)Math.Round(extension.TotalAmount * 100m, MidpointRounding.AwayFromZero);
        if (amountPaise < 100)
        {
            return Result.Failure<ExtensionPaymentDto>(new Error(
                "payments.amount_too_small",
                "Extension total is too small to charge.",
                ErrorCategory.Validation));
        }

        var receipt = ExtensionPaymentReceipt.For(extension.Id);
        var existing = await customers.GetOpenCheckoutSessionByReceiptAsync(receipt, cancellationToken);
        if (existing is not null
            && existing.CustomerId == request.CustomerId
            && existing.Amount == extension.TotalAmount
            && string.Equals(existing.Source, CheckoutSessionSources.RentalExtension, StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(existing.RazorpayOrderId))
        {
            return Result.Success(ToDto(existing, razorpay.KeyId, extension.Id, request.OrderId));
        }

        var sessionId = Guid.NewGuid();
        var session = new CustomerCheckoutSession
        {
            Id = sessionId,
            CustomerId = request.CustomerId,
            Source = CheckoutSessionSources.RentalExtension,
            Status = CheckoutSessionStatuses.Created,
            Amount = extension.TotalAmount,
            Currency = "INR",
            Receipt = receipt,
        };

        await customers.AddCheckoutSessionAsync(session, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        var notes = new Dictionary<string, string>
        {
            ["checkout_session_id"] = sessionId.ToString(),
            ["customer_id"] = request.CustomerId.ToString(),
            ["extension_id"] = extension.Id.ToString(),
            ["order_id"] = request.OrderId.ToString(),
        };

        try
        {
            var rzOrder = await razorpay.CreateOrderAsync(amountPaise, "INR", receipt, notes, cancellationToken);
            session.RazorpayOrderId = rzOrder.OrderId;
            await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Success(ToDto(session, razorpay.KeyId, extension.Id, request.OrderId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create Razorpay order for extension {ExtensionId}", extension.Id);
            session.Status = CheckoutSessionStatuses.Failed;
            await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);
            return Result.Failure<ExtensionPaymentDto>(new Error(
                "payments.razorpay_create_failed",
                "Unable to start payment. Please try again.",
                ErrorCategory.Validation));
        }
    }

    private static ExtensionPaymentDto ToDto(CustomerCheckoutSession session, string keyId, Guid extensionId, Guid orderId) =>
        new(session.Id, keyId, session.RazorpayOrderId, session.Amount, session.Currency, extensionId, orderId);
}

public sealed record VerifyExtensionPaymentCommand(
    Guid CustomerId,
    Guid OrderId,
    Guid ExtensionId,
    Guid CheckoutSessionId,
    string RazorpayOrderId,
    string RazorpayPaymentId,
    string RazorpaySignature) : ICommand<bool>;

internal sealed class VerifyExtensionPaymentCommandHandler(
    ICustomerRepository customers,
    IRazorpayPaymentService razorpay,
    IMediator mediator,
    IEmailService email,
    ILogger<VerifyExtensionPaymentCommandHandler> logger) : ICommandHandler<VerifyExtensionPaymentCommand, bool>
{
    public async Task<Result<bool>> Handle(VerifyExtensionPaymentCommand request, CancellationToken cancellationToken)
    {
        if (!razorpay.VerifyPaymentSignature(request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature))
        {
            return Result.Failure<bool>(new Error(
                "payments.invalid_signature",
                "Payment verification failed.",
                ErrorCategory.Validation));
        }

        var session = await customers.GetCheckoutSessionByIdAsync(request.CheckoutSessionId, cancellationToken);
        if (session is null || session.CustomerId != request.CustomerId)
            return Result.Failure<bool>(new Error("payments.session_not_found", "Checkout session not found.", ErrorCategory.NotFound));

        if (!string.Equals(session.Source, CheckoutSessionSources.RentalExtension, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<bool>(new Error("payments.session_mismatch", "This payment is not for a rental extension.", ErrorCategory.Validation));

        if (!string.Equals(session.RazorpayOrderId, request.RazorpayOrderId, StringComparison.Ordinal))
            return Result.Failure<bool>(new Error("payments.order_mismatch", "Payment does not match this extension.", ErrorCategory.Validation));

        if (!ExtensionPaymentReceipt.TryParse(session.Receipt, out var extensionId) || extensionId != request.ExtensionId)
            return Result.Failure<bool>(new Error("payments.extension_mismatch", "Payment does not match this extension.", ErrorCategory.Validation));

        var owned = await customers.GetCustomerOrderAsync(request.CustomerId, request.OrderId, cancellationToken);
        if (owned is null || owned.Order.IsDeleted)
            return Result.Failure<bool>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        return await ExtensionPaymentActivator.ApplyAsync(
            customers,
            mediator,
            email,
            logger,
            session,
            request.RazorpayPaymentId,
            cancellationToken);
    }
}

internal static class ExtensionPaymentActivator
{
    public static async Task<Result<bool>> ApplyAsync(
        ICustomerRepository customers,
        IMediator mediator,
        IEmailService email,
        ILogger logger,
        CustomerCheckoutSession session,
        string? razorpayPaymentId,
        CancellationToken cancellationToken)
    {
        if (!ExtensionPaymentReceipt.TryParse(session.Receipt, out var extensionId))
            return Result.Failure<bool>(new Error("payments.extension_mismatch", "Payment does not match an extension.", ErrorCategory.Validation));

        var extension = await customers.GetCustomerRentalOrderExtensionByIdAsync(extensionId, cancellationToken);
        if (extension is null)
            return Result.Failure<bool>(new Error("extensions.not_found", "Extension request not found.", ErrorCategory.NotFound));

        var orderRow = await customers.GetCustomerOrderByIdAsync(extension.CustomerRentalOrderId, cancellationToken);
        var listing = orderRow?.Order is null
            ? null
            : await customers.GetListingForCustomerAsync(orderRow.Order.VendorProductListingId, cancellationToken);
        var vendorCredit = RentalExtensionPayout.For(orderRow?.Order, listing, extension.AdditionalDays, extension.ExtensionAmount);

        var applied = await customers.ApplyPaidRentalExtensionAsync(extension.Id, session.Id, razorpayPaymentId, vendorCredit, cancellationToken);
        if (applied == ExtensionPaymentApplyResult.NotPayable)
            return Result.Failure<bool>(new Error("extensions.not_payable", "This extension is not ready for payment.", ErrorCategory.Validation));

        if (applied == ExtensionPaymentApplyResult.AlreadyPaid)
            return Result.Success(true);

        var row = await customers.GetCustomerOrderByIdAsync(extension.CustomerRentalOrderId, cancellationToken);
        var order = row?.Order;
        if (order is null)
            return Result.Success(true);

        var productName = string.IsNullOrWhiteSpace(row?.Listing?.ListingTitle) ? "this product" : row!.Listing!.ListingTitle.Trim();
        var endLabel = extension.NewEndDate.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);

        try
        {
            await mediator.Send(new CreateCustomerNotificationCommand(
                order.CustomerId,
                "customer_extension_paid",
                "Extension Paid",
                $"Payment received for the {extension.AdditionalDays}-day extension of {productName} ({order.OrderNumber}). The rental now ends on {endLabel}.",
                order.Id), cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Extension {ExtensionId} was paid but the customer notification failed.", extension.Id);
        }

        try
        {
            var vendorListing = listing ?? await customers.GetListingForCustomerAsync(order.VendorProductListingId, cancellationToken);
            if (vendorListing is not null)
            {
                await mediator.Send(new CreateVendorNotificationCommand(
                    vendorListing.VendorId.ToString(),
                    "order_extension_paid",
                    "Extension Paid",
                    $"The customer paid the {extension.AdditionalDays}-day extension for order {order.OrderNumber} ({productName}). The rental now ends on {endLabel}. [ID: {order.Id}]",
                    "push",
                    "pending"), cancellationToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Extension {ExtensionId} was paid but the vendor notification failed.", extension.Id);
        }

        await PaymentInvoiceMailer.SendExtensionPaymentAsync(
            customers,
            email,
            logger,
            session,
            extension,
            razorpayPaymentId,
            cancellationToken);

        return Result.Success(true);
    }
}
