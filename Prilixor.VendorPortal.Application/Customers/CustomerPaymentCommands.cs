using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record CustomerCheckoutDto(
    Guid CheckoutSessionId,
    string RazorpayKeyId,
    string? RazorpayOrderId,
    decimal Amount,
    string Currency,
    string? PaymentLinkUrl,
    List<CustomerOrderDto> Orders,
    List<FailedCustomerOrderLineDto> FailedLines);

public sealed record CreateCustomerCheckoutCommand(
    Guid CustomerId,
    Guid? CustomerAddressId,
    string DeliveryOption,
    IReadOnlyList<CartLineRequest> Lines,
    string Source,
    Guid? PlacedByAdminId = null) : ICommand<CustomerCheckoutDto>;

public sealed class CreateCustomerCheckoutCommandValidator : AbstractValidator<CreateCustomerCheckoutCommand>
{
    public CreateCustomerCheckoutCommandValidator()
    {
        RuleFor(x => x.DeliveryOption).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Lines).NotEmpty();
        RuleFor(x => x.Source).NotEmpty();
    }
}

internal sealed class CreateCustomerCheckoutCommandHandler(
    IMediator mediator,
    ICustomerRepository customers,
    IRazorpayPaymentService razorpay,
    IEmailService email,
    IConfiguration configuration,
    ILogger<CreateCustomerCheckoutCommandHandler> logger) : ICommandHandler<CreateCustomerCheckoutCommand, CustomerCheckoutDto>
{
    public async Task<Result<CustomerCheckoutDto>> Handle(CreateCustomerCheckoutCommand request, CancellationToken cancellationToken)
    {
        if (!razorpay.IsConfigured)
        {
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.razorpay_not_configured",
                "Payment gateway is not configured. Contact support.",
                ErrorCategory.Validation));
        }

        var placeResult = await mediator.Send(new PlaceCustomerOrdersCommand(
            request.CustomerId,
            request.CustomerAddressId,
            request.DeliveryOption,
            request.Lines,
            request.PlacedByAdminId,
            AwaitPayment: true), cancellationToken);

        if (!placeResult.IsSuccess)
            return Result.Failure<CustomerCheckoutDto>(placeResult.Errors);

        var placed = placeResult.Value.PlacedOrders;
        var failed = placeResult.Value.FailedLines;
        if (placed.Count == 0)
        {
            return Result.Success(new CustomerCheckoutDto(
                Guid.Empty,
                razorpay.KeyId,
                null,
                0,
                "INR",
                null,
                placed,
                failed));
        }

        var amount = placed.Sum(o => o.TotalAmount);
        var amountPaise = (long)Math.Round(amount * 100m, MidpointRounding.AwayFromZero);
        if (amountPaise < 100)
        {
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.amount_too_small",
                "Order total is too small to charge.",
                ErrorCategory.Validation));
        }

        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null)
            return Result.Failure<CustomerCheckoutDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var sessionId = Guid.NewGuid();
        // Razorpay receipt max length is 40; chk_ + Guid "N" is 36 chars.
        var receipt = $"chk_{sessionId:N}";
        var session = new CustomerCheckoutSession
        {
            Id = sessionId,
            CustomerId = request.CustomerId,
            Source = request.Source,
            Status = CheckoutSessionStatuses.Created,
            Amount = amount,
            Currency = "INR",
            Receipt = receipt,
            PlacedByAdminId = request.PlacedByAdminId,
        };

        await customers.AddCheckoutSessionAsync(session, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        foreach (var orderDto in placed)
        {
            var order = await customers.GetCustomerOrderEntityByIdAsync(orderDto.Id, cancellationToken);
            if (order is null)
                continue;

            order.CheckoutSessionId = sessionId;
            await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            await customers.AddCheckoutSessionOrderAsync(new CustomerCheckoutSessionOrder
            {
                CheckoutSessionId = sessionId,
                CustomerRentalOrderId = order.Id,
            }, cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);

        var notes = new Dictionary<string, string>
        {
            ["checkout_session_id"] = sessionId.ToString(),
            ["customer_id"] = request.CustomerId.ToString(),
        };

        try
        {
            if (string.Equals(request.Source, CheckoutSessionSources.AdminPaymentLink, StringComparison.OrdinalIgnoreCase))
            {
                var frontend = (configuration["FrontendUrl"] ?? "https://blinksmed.com").Trim().TrimEnd('/');
                var callbackUrl = $"{frontend}/customer/orders";
                var referenceId = sessionId.ToString("N");
                if (referenceId.Length > 40)
                    referenceId = referenceId[..40];

                var link = await razorpay.CreatePaymentLinkAsync(
                    amountPaise,
                    "INR",
                    $"BlinksMed order payment ({placed.Count} item(s))",
                    customer.FullName,
                    customer.Email,
                    customer.Phone,
                    referenceId,
                    callbackUrl,
                    notes,
                    cancellationToken);

                session.RazorpayPaymentLinkId = link.PaymentLinkId;
                session.PaymentLinkUrl = link.ShortUrl;
                if (!string.IsNullOrWhiteSpace(link.OrderId))
                    session.RazorpayOrderId = link.OrderId;

                await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
                await customers.SaveChangesAsync(cancellationToken);

                try
                {
                    await email.SendEmailAsync(
                        customer.Email,
                        "Complete your BlinksMed payment",
                        $"""
                        <p>Hi {System.Net.WebUtility.HtmlEncode(customer.FullName)},</p>
                        <p>An order was prepared for you. Please complete payment using the link below:</p>
                        <p><a href="{System.Net.WebUtility.HtmlEncode(link.ShortUrl)}">{System.Net.WebUtility.HtmlEncode(link.ShortUrl)}</a></p>
                        <p>Amount: ₹{amount:0.00}</p>
                        <p>After payment, your order will be sent to vendors for acceptance.</p>
                        """,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to email Razorpay payment link for session {SessionId}", sessionId);
                }

                return Result.Success(new CustomerCheckoutDto(
                    sessionId,
                    razorpay.KeyId,
                    session.RazorpayOrderId,
                    amount,
                    "INR",
                    link.ShortUrl,
                    placed,
                    failed));
            }

            var rzOrder = await razorpay.CreateOrderAsync(amountPaise, "INR", receipt, notes, cancellationToken);
            session.RazorpayOrderId = rzOrder.OrderId;
            await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
            await customers.SaveChangesAsync(cancellationToken);

            return Result.Success(new CustomerCheckoutDto(
                sessionId,
                razorpay.KeyId,
                rzOrder.OrderId,
                amount,
                "INR",
                null,
                placed,
                failed));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create Razorpay checkout for session {SessionId}", sessionId);
            session.Status = CheckoutSessionStatuses.Failed;
            await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
            foreach (var orderDto in placed)
            {
                var order = await customers.GetCustomerOrderEntityByIdAsync(orderDto.Id, cancellationToken);
                if (order is null) continue;
                order.Status = "cancelled";
                await customers.UpdateCustomerRentalOrderAsync(order, cancellationToken);
            }

            await customers.SaveChangesAsync(cancellationToken);
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.razorpay_create_failed",
                "Unable to start payment. Please try again.",
                ErrorCategory.Validation));
        }
    }
}

public sealed record VerifyCustomerCheckoutCommand(
    Guid CustomerId,
    Guid CheckoutSessionId,
    string RazorpayOrderId,
    string RazorpayPaymentId,
    string RazorpaySignature) : ICommand<CustomerCheckoutDto>;

internal sealed class VerifyCustomerCheckoutCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IRazorpayPaymentService razorpay,
    IOptions<CustomerPricingOptions> pricingOptions) : ICommandHandler<VerifyCustomerCheckoutCommand, CustomerCheckoutDto>
{
    public async Task<Result<CustomerCheckoutDto>> Handle(VerifyCustomerCheckoutCommand request, CancellationToken cancellationToken)
    {
        if (!razorpay.VerifyPaymentSignature(request.RazorpayOrderId, request.RazorpayPaymentId, request.RazorpaySignature))
        {
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.invalid_signature",
                "Payment verification failed.",
                ErrorCategory.Validation));
        }

        var session = await customers.GetCheckoutSessionByIdAsync(request.CheckoutSessionId, cancellationToken);
        if (session is null || session.CustomerId != request.CustomerId)
            return Result.Failure<CustomerCheckoutDto>(new Error("payments.session_not_found", "Checkout session not found.", ErrorCategory.NotFound));

        if (!string.Equals(session.RazorpayOrderId, request.RazorpayOrderId, StringComparison.Ordinal))
            return Result.Failure<CustomerCheckoutDto>(new Error("payments.order_mismatch", "Payment does not match this checkout.", ErrorCategory.Validation));

        await CheckoutPaymentActivator.MarkPaidAndDispatchAsync(
            customers,
            vendors,
            pricingOptions.Value,
            session,
            request.RazorpayPaymentId,
            cancellationToken);

        var orders = await LoadOrderDtos(customers, session.Id, cancellationToken);
        return Result.Success(new CustomerCheckoutDto(
            session.Id,
            razorpay.KeyId,
            session.RazorpayOrderId,
            session.Amount,
            session.Currency,
            session.PaymentLinkUrl,
            orders,
            []));
    }

    private static async Task<List<CustomerOrderDto>> LoadOrderDtos(
        ICustomerRepository customers,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var entities = await customers.GetOrdersByCheckoutSessionIdAsync(sessionId, cancellationToken);
        var result = new List<CustomerOrderDto>();
        foreach (var o in entities)
        {
            var row = await customers.GetCustomerOrderAsync(o.CustomerId, o.Id, cancellationToken);
            if (row is null) continue;
            result.Add(MapOrder(row));
        }

        return result;
    }

    internal static CustomerOrderDto MapOrder(CustomerRentalOrderWithListing row)
    {
        var o = row.Order;
        var listing = row.Listing;
        var vendorName = listing?.Vendor?.Profile?.BusinessName ?? listing?.Vendor?.Email ?? "Vendor";
        return new CustomerOrderDto(
            o.Id,
            o.OrderNumber,
            o.VendorProductListingId,
            listing?.ListingTitle ?? "Item",
            vendorName,
            listing?.VendorId ?? Guid.Empty,
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
            o.RentalPeriodUnit,
            row.ListingPrimaryImageUrl,
            ProductVariantId: o.ProductVariantId,
            DoctorId: o.DoctorReference?.DoctorId,
            RentalPricingPlanId: o.RentalPricingPlanId,
            RentalDurationLabel: o.RentalDurationLabel,
            RentalDurationDays: o.RentalDurationDays,
            RentalNormalPrice: o.RentalNormalPrice,
            RentalDiscountType: o.RentalDiscountType,
            RentalDiscountValue: o.RentalDiscountValue,
            RentalFinalPrice: o.RentalFinalPrice);
    }
}

public sealed record ProcessRazorpayWebhookCommand(string RawBody, string SignatureHeader) : ICommand<bool>;

internal sealed class ProcessRazorpayWebhookCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IRazorpayPaymentService razorpay,
    IOptions<RazorpayOptions> razorpayOptions,
    IOptions<CustomerPricingOptions> pricingOptions,
    ILogger<ProcessRazorpayWebhookCommandHandler> logger) : ICommandHandler<ProcessRazorpayWebhookCommand, bool>
{
    public async Task<Result<bool>> Handle(ProcessRazorpayWebhookCommand request, CancellationToken cancellationToken)
    {
        var webhookSecret = razorpayOptions.Value.WebhookSecret;
        if (!string.IsNullOrWhiteSpace(webhookSecret))
        {
            if (!razorpay.VerifyWebhookSignature(request.RawBody, request.SignatureHeader))
            {
                return Result.Failure<bool>(new Error(
                    "payments.invalid_webhook_signature",
                    "Invalid webhook signature.",
                    ErrorCategory.Validation));
            }
        }
        else
        {
            logger.LogWarning("Razorpay webhook accepted without signature verification (WebhookSecret not configured).");
        }

        using var doc = JsonDocument.Parse(request.RawBody);
        var root = doc.RootElement;
        var eventName = root.TryGetProperty("event", out var ev) ? ev.GetString() : null;
        if (string.IsNullOrWhiteSpace(eventName))
            return Result.Success(true);

        if (eventName is "payment.captured" or "order.paid")
            await TryActivateFromPaymentEntity(root, cancellationToken);
        else if (eventName is "payment_link.paid")
            await TryActivateFromPaymentLink(root, cancellationToken);

        return Result.Success(true);
    }

    private async Task TryActivateFromPaymentEntity(JsonElement root, CancellationToken cancellationToken)
    {
        if (!root.TryGetProperty("payload", out var payload))
            return;

        string? orderId = null;
        string? paymentId = null;

        if (payload.TryGetProperty("payment", out var paymentWrap) &&
            paymentWrap.TryGetProperty("entity", out var payment))
        {
            paymentId = payment.TryGetProperty("id", out var pid) ? pid.GetString() : null;
            orderId = payment.TryGetProperty("order_id", out var oid) ? oid.GetString() : null;
        }

        if (string.IsNullOrWhiteSpace(orderId) &&
            payload.TryGetProperty("order", out var orderWrap) &&
            orderWrap.TryGetProperty("entity", out var orderEntity))
        {
            orderId = orderEntity.TryGetProperty("id", out var oid2) ? oid2.GetString() : null;
        }

        if (string.IsNullOrWhiteSpace(orderId))
            return;

        var session = await customers.GetCheckoutSessionByRazorpayOrderIdAsync(orderId, cancellationToken);
        if (session is null)
            return;

        await CheckoutPaymentActivator.MarkPaidAndDispatchAsync(
            customers, vendors, pricingOptions.Value, session, paymentId, cancellationToken);
    }

    private async Task TryActivateFromPaymentLink(JsonElement root, CancellationToken cancellationToken)
    {
        if (!root.TryGetProperty("payload", out var payload) ||
            !payload.TryGetProperty("payment_link", out var linkWrap) ||
            !linkWrap.TryGetProperty("entity", out var link))
            return;

        var linkId = link.TryGetProperty("id", out var lid) ? lid.GetString() : null;
        if (string.IsNullOrWhiteSpace(linkId))
            return;

        string? paymentId = null;
        string? orderId = null;
        if (payload.TryGetProperty("payment", out var paymentWrap) &&
            paymentWrap.TryGetProperty("entity", out var payment))
        {
            paymentId = payment.TryGetProperty("id", out var pid) ? pid.GetString() : null;
            orderId = payment.TryGetProperty("order_id", out var oid) ? oid.GetString() : null;
        }

        var session = await customers.GetCheckoutSessionByPaymentLinkIdAsync(linkId, cancellationToken);
        if (session is null)
            return;

        if (!string.IsNullOrWhiteSpace(orderId) && string.IsNullOrWhiteSpace(session.RazorpayOrderId))
            session.RazorpayOrderId = orderId;

        await CheckoutPaymentActivator.MarkPaidAndDispatchAsync(
            customers, vendors, pricingOptions.Value, session, paymentId, cancellationToken);
    }
}

internal static class CheckoutPaymentActivator
{
    public static async Task MarkPaidAndDispatchAsync(
        ICustomerRepository customers,
        IVendorOnboardingRepository vendors,
        CustomerPricingOptions options,
        CustomerCheckoutSession session,
        string? razorpayPaymentId,
        CancellationToken cancellationToken)
    {
        if (string.Equals(session.Status, CheckoutSessionStatuses.Paid, StringComparison.OrdinalIgnoreCase))
            return;

        session.Status = CheckoutSessionStatuses.Paid;
        session.PaidAt = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(razorpayPaymentId))
            session.RazorpayPaymentId = razorpayPaymentId;
        session.ModifiedOnUtc = DateTime.UtcNow;
        await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);

        var orders = await customers.GetOrdersByCheckoutSessionIdAsync(session.Id, cancellationToken);
        foreach (var order in orders)
        {
            await CustomerOrderDispatchStarter.ActivatePaidOrderAsync(
                customers, vendors, options, order, cancellationToken);
        }
    }
}
