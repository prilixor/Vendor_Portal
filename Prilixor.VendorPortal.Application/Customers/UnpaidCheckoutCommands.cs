using MediatR;
using Microsoft.Extensions.Logging;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

/// <summary>
/// Cancels the unpaid draft orders of one checkout session (stock released, discount released,
/// session closed). A paid order is never touched: the cancel command refuses anything that is
/// no longer <c>awaiting_payment</c>.
/// </summary>
internal static class UnpaidCheckoutCleaner
{
    public static async Task<int> CancelSessionDraftsAsync(
        IMediator mediator,
        ICustomerRepository customers,
        IDiscountCodeRepository discountCodes,
        ILogger logger,
        Guid sessionId,
        Guid customerId,
        string closedStatus,
        bool notifyCustomer,
        CancellationToken cancellationToken)
    {
        var cancelled = 0;
        var orders = await customers.GetOrdersByCheckoutSessionIdAsync(sessionId, cancellationToken);
        foreach (var order in orders)
        {
            if (!string.Equals(order.Status, "awaiting_payment", StringComparison.OrdinalIgnoreCase))
                continue;

            try
            {
                var result = await mediator.Send(
                    new CancelCustomerOrderCommand(customerId, order.Id, Expired: true, NotifyCustomer: notifyCustomer),
                    cancellationToken);
                if (result.IsSuccess)
                    cancelled++;
                else
                    logger.LogInformation(
                        "Unpaid draft {OrderId} was not cancelled: {Error}",
                        order.Id,
                        result.Errors.FirstOrDefault()?.Description);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not cancel unpaid draft {OrderId}.", order.Id);
            }
        }

        var session = await customers.GetCheckoutSessionByIdAsync(sessionId, cancellationToken);
        if (session is null
            || !string.Equals(session.Status, CheckoutSessionStatuses.Created, StringComparison.OrdinalIgnoreCase))
            return cancelled;

        // Only close the session once none of its orders are still waiting for payment.
        var remaining = await customers.GetOrdersByCheckoutSessionIdAsync(sessionId, cancellationToken);
        if (remaining.Any(o => string.Equals(o.Status, "awaiting_payment", StringComparison.OrdinalIgnoreCase)))
            return cancelled;

        session.Status = closedStatus;
        session.ModifiedOnUtc = DateTime.UtcNow;
        await discountCodes.ReleaseBySessionAsync(sessionId, cancellationToken);
        await customers.UpdateCheckoutSessionAsync(session, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        return cancelled;
    }
}

/// <summary>
/// Cancels checkout drafts that were never paid (the customer closed the Razorpay window and left).
/// Stock and the discount reservation are released and the checkout session is marked expired.
/// Admin payment links and rental extensions are never touched.
/// </summary>
public sealed record ExpireUnpaidCheckoutsCommand(TimeSpan MaxAge, int BatchSize = 100) : ICommand<int>;

internal sealed class ExpireUnpaidCheckoutsCommandHandler(
    IMediator mediator,
    ICustomerRepository customers,
    IDiscountCodeRepository discountCodes,
    ILogger<ExpireUnpaidCheckoutsCommandHandler> logger)
    : ICommandHandler<ExpireUnpaidCheckoutsCommand, int>
{
    public async Task<Result<int>> Handle(ExpireUnpaidCheckoutsCommand request, CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow - request.MaxAge;
        var drafts = await customers.ListAbandonedCheckoutDraftsAsync(cutoff, Math.Clamp(request.BatchSize, 1, 500), cancellationToken);
        if (drafts.Count == 0)
            return Result.Success(0);

        var cancelled = 0;
        foreach (var session in drafts.GroupBy(d => (d.CheckoutSessionId, d.CustomerId)))
        {
            try
            {
                cancelled += await UnpaidCheckoutCleaner.CancelSessionDraftsAsync(
                    mediator,
                    customers,
                    discountCodes,
                    logger,
                    session.Key.CheckoutSessionId,
                    session.Key.CustomerId,
                    CheckoutSessionStatuses.Expired,
                    notifyCustomer: true,
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not expire checkout session {SessionId}.", session.Key.CheckoutSessionId);
            }
        }

        if (cancelled > 0)
            logger.LogInformation("Expired {Count} unpaid checkout draft(s).", cancelled);
        return Result.Success(cancelled);
    }
}

/// <summary>
/// Lets a customer finish paying for a draft order they left behind, before it expires.
/// Returns the same payload as a fresh checkout so the web app can reopen Razorpay.
/// </summary>
public sealed record ResumeCustomerCheckoutQuery(Guid CustomerId, Guid OrderId) : IQuery<CustomerCheckoutDto>;

internal sealed class ResumeCustomerCheckoutQueryHandler(
    ICustomerRepository customers,
    IRazorpayPaymentService razorpay)
    : IQueryHandler<ResumeCustomerCheckoutQuery, CustomerCheckoutDto>
{
    public async Task<Result<CustomerCheckoutDto>> Handle(ResumeCustomerCheckoutQuery request, CancellationToken cancellationToken)
    {
        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.CustomerId != request.CustomerId || order.IsDeleted)
            return Result.Failure<CustomerCheckoutDto>(new Error("customers.order_not_found", "Order not found.", ErrorCategory.NotFound));

        if (!string.Equals(order.Status, "awaiting_payment", StringComparison.OrdinalIgnoreCase) || order.CheckoutSessionId is null)
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.not_awaiting_payment", "This order is not waiting for payment.", ErrorCategory.Validation));

        var session = await customers.GetCheckoutSessionByIdAsync(order.CheckoutSessionId.Value, cancellationToken);
        if (session is null
            || session.CustomerId != request.CustomerId
            || !string.Equals(session.Status, CheckoutSessionStatuses.Created, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(session.RazorpayOrderId))
            return Result.Failure<CustomerCheckoutDto>(new Error(
                "payments.session_closed", "This payment is no longer available. Please place the order again.", ErrorCategory.Validation));

        var orders = new List<CustomerOrderDto>();
        foreach (var o in await customers.GetOrdersByCheckoutSessionIdAsync(session.Id, cancellationToken))
        {
            var row = await customers.GetCustomerOrderAsync(o.CustomerId, o.Id, cancellationToken);
            if (row is not null)
                orders.Add(VerifyCustomerCheckoutCommandHandler.MapOrder(row));
        }

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
}
