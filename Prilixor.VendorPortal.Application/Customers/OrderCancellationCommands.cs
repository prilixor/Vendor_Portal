using Microsoft.Extensions.Logging;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public static class OrderCancellationRefunds
{
    public const int ReasonMaxLength = 500;

    private static string TrimLabel(string label) =>
        label.Length <= 240 ? label : label[..240];

    /// <summary>
    /// Opens one review row when this product was already paid. An existing row is left unchanged.
    /// Unpaid products and products already in the deposit-return flow are skipped.
    /// </summary>
    public static async Task<Result<CustomerOrderCancellationRefund?>> TryOpenAsync(
        ICustomerRepository customers,
        CustomerRentalOrder order,
        string outcome,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken)
    {
        var existing = await customers.GetOrderCancellationRefundByOrderIdAsync(order.Id, cancellationToken);
        if (existing is not null)
            return Result.Success<CustomerOrderCancellationRefund?>(existing);

        var depositReturn = await customers.GetOrderReturnByOrderIdAsync(order.Id, cancellationToken);
        if (depositReturn is not null)
            return Result.Success<CustomerOrderCancellationRefund?>(null);

        var extensions = await customers.GetCustomerExtensionHistoryAsync(order.Id, cancellationToken);
        var extensionPaid = decimal.Round(
            extensions
                .Where(e => string.Equals(e.Status, RentalExtensionStatuses.Paid, StringComparison.OrdinalIgnoreCase))
                .Sum(e => e.TotalAmount),
            2,
            MidpointRounding.AwayFromZero);

        decimal originalPaid = 0;
        var hasOnline = false;
        string? originalPaymentId = null;
        if (order.CheckoutSessionId is Guid sessionId)
        {
            var session = await customers.GetCheckoutSessionByIdAsync(sessionId, cancellationToken);
            if (session is not null
                && !session.IsDeleted
                && string.Equals(session.Status, CheckoutSessionStatuses.Paid, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(session.Source, CheckoutSessionSources.RentalExtension, StringComparison.OrdinalIgnoreCase))
            {
                originalPaid = decimal.Round(
                    Math.Max(0, order.TotalAmount - extensionPaid),
                    2,
                    MidpointRounding.AwayFromZero);
                originalPaymentId = session.RazorpayPaymentId;
                hasOnline = !string.IsNullOrWhiteSpace(originalPaymentId);
            }
            else
            {
                extensionPaid = 0;
            }
        }

        if (!hasOnline && extensionPaid > 0)
        {
            var extensionSessions = await customers.GetPaidExtensionSessionsAsync(order.Id, cancellationToken);
            hasOnline = extensionSessions.Any(s => !string.IsNullOrWhiteSpace(s.RazorpayPaymentId));
        }

        var paid = decimal.Round(originalPaid + extensionPaid, 2, MidpointRounding.AwayFromZero);
        if (paid <= 0)
            return Result.Success<CustomerOrderCancellationRefund?>(null);

        var normalizedOutcome = string.Equals(outcome, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase)
            ? CancellationOutcomes.DispatchFailed
            : CancellationOutcomes.Cancelled;

        var row = new CustomerOrderCancellationRefund
        {
            Id = Guid.NewGuid(),
            CustomerRentalOrderId = order.Id,
            Outcome = normalizedOutcome,
            ActorRole = string.IsNullOrWhiteSpace(actorRole) ? CancellationActors.Unknown : actorRole.Trim().ToLowerInvariant(),
            ActorLabel = TrimLabel(CancellationActors.Label(actorRole, normalizedOutcome, actorName)),
            PaidAmount = paid,
            OriginalPaidAmount = originalPaid,
            ExtensionPaidAmount = extensionPaid,
            ChargeAmount = 0,
            RefundAmount = paid,
            RefundedOnlineAmount = 0,
            Status = CancellationRefundStatuses.PendingReview,
            HasOnlinePayment = hasOnline,
            RazorpayPaymentId = string.IsNullOrWhiteSpace(originalPaymentId) ? null : originalPaymentId.Trim(),
        };
        await customers.AddOrderCancellationRefundAsync(row, cancellationToken);
        return Result.Success<CustomerOrderCancellationRefund?>(row);
    }

    public static async Task EnsureForOrdersAsync(
        ICustomerRepository customers,
        IEnumerable<CustomerRentalOrder> orders,
        CancellationToken cancellationToken)
    {
        var created = false;
        foreach (var order in orders)
        {
            if (order.IsDeleted)
                continue;
            var failed = string.Equals(order.Status, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase);
            var cancelled = string.Equals(order.Status, CancellationOutcomes.Cancelled, StringComparison.OrdinalIgnoreCase);
            if (!failed && !cancelled)
                continue;

            var existing = await customers.GetOrderCancellationRefundByOrderIdAsync(order.Id, cancellationToken);
            if (existing is not null)
                continue;

            var opened = await TryOpenAsync(
                customers,
                order,
                failed ? CancellationOutcomes.DispatchFailed : CancellationOutcomes.Cancelled,
                failed ? CancellationActors.System : CancellationActors.Unknown,
                null,
                cancellationToken);
            if (opened.IsSuccess && opened.Value is not null)
                created = true;
        }

        if (created)
            await customers.SaveChangesAsync(cancellationToken);
    }

    public static async Task EnsureRecentAsync(ICustomerRepository customers, CancellationToken cancellationToken)
    {
        var orders = await customers.ListPaidClosedOrdersMissingCancellationRefundAsync(40, cancellationToken);
        if (orders.Count == 0)
            return;

        await EnsureForOrdersAsync(customers, orders, cancellationToken);
    }
}

public sealed record RefundOrderCancellationCommand(
    string AdminId,
    Guid OrderId,
    decimal ChargeAmount,
    string? ChargeReason,
    string? ManualReference) : ICommand<OrderCancellationRefundDto>;

internal sealed class RefundOrderCancellationCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IRazorpayPaymentService razorpay,
    ILogger<RefundOrderCancellationCommandHandler> logger)
    : ICommandHandler<RefundOrderCancellationCommand, OrderCancellationRefundDto>
{
    public async Task<Result<OrderCancellationRefundDto>> Handle(
        RefundOrderCancellationCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "admin.invalid_id",
                "Admin user id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var adminUser = await vendors.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "admin.not_found",
                "Active admin user not found.",
                ErrorCategory.NotFound));
        }

        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.IsDeleted)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "customers.order_not_found",
                "Order not found.",
                ErrorCategory.NotFound));
        }

        var row = await customers.GetOrderCancellationRefundByOrderIdAsync(order.Id, cancellationToken);
        if (row is null)
        {
            var failed = string.Equals(order.Status, CancellationOutcomes.DispatchFailed, StringComparison.OrdinalIgnoreCase);
            var cancelled = string.Equals(order.Status, CancellationOutcomes.Cancelled, StringComparison.OrdinalIgnoreCase);
            if (!failed && !cancelled)
            {
                return Result.Failure<OrderCancellationRefundDto>(new Error(
                    "orders.cancel_refund.not_closed",
                    "Refund this payment only after the product is cancelled or dispatch failed.",
                    ErrorCategory.Validation));
            }

            var opened = await OrderCancellationRefunds.TryOpenAsync(
                customers,
                order,
                failed ? CancellationOutcomes.DispatchFailed : CancellationOutcomes.Cancelled,
                failed ? CancellationActors.System : CancellationActors.Unknown,
                null,
                cancellationToken);
            if (opened.IsFailure)
                return Result.Failure<OrderCancellationRefundDto>(opened.Errors[0]);
            row = opened.Value;
            if (row is null)
            {
                return Result.Failure<OrderCancellationRefundDto>(new Error(
                    "orders.cancel_refund.not_paid",
                    "This product has no captured payment to refund.",
                    ErrorCategory.Validation));
            }

            await customers.SaveChangesAsync(cancellationToken);
        }

        if (row.Status == CancellationRefundStatuses.Refunded)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.already_refunded",
                "This payment was already refunded.",
                ErrorCategory.Validation));
        }

        if (row.Status == CancellationRefundStatuses.Settled)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.nothing_due",
                "No refund is due on this product.",
                ErrorCategory.Validation));
        }

        var manual = request.ManualReference?.Trim();
        if (manual is { Length: > 120 })
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.reference_too_long",
                "Keep the payment reference under 120 characters.",
                ErrorCategory.Validation));
        }

        if (row.Status == CancellationRefundStatuses.Refunding)
        {
            if (!string.IsNullOrWhiteSpace(manual))
            {
                ApplyPaid(row, OrderRefundMethods.Manual, manual, keepOnlineIds: true);
                await FinishAsync(order, row, adminUserId, cancellationToken);
                return Result.Success(OrderCancellationMapper.ToDto(row));
            }

            var continued = await RefundOnlineAsync(order, row, cancellationToken);
            if (continued.IsFailure)
                return Result.Failure<OrderCancellationRefundDto>(continued.Errors[0]);

            await FinishAsync(order, row, adminUserId, cancellationToken);
            return Result.Success(OrderCancellationMapper.ToDto(row));
        }

        if (row.Status != CancellationRefundStatuses.PendingReview)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.not_pending",
                "This payment is not waiting for a refund.",
                ErrorCategory.Validation));
        }

        var charge = decimal.Round(request.ChargeAmount, 2, MidpointRounding.AwayFromZero);
        if (charge < 0)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.charge_negative",
                "The charge cannot be negative.",
                ErrorCategory.Validation));
        }

        if (charge > row.PaidAmount)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.charge_exceeds_paid",
                $"The charge cannot be more than the {OrderReturnMapper.Money(row.PaidAmount)} paid for this product.",
                ErrorCategory.Validation));
        }

        var reason = request.ChargeReason?.Trim();
        if (charge > 0 && string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.reason_required",
                "Add a short reason for the charge.",
                ErrorCategory.Validation));
        }

        if (reason is { Length: > OrderCancellationRefunds.ReasonMaxLength })
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.reason_too_long",
                "Keep the charge reason under 500 characters.",
                ErrorCategory.Validation));
        }

        var refund = decimal.Round(row.PaidAmount - charge, 2, MidpointRounding.AwayFromZero);
        var storedReason = charge > 0 ? reason : null;

        if (refund <= 0)
        {
            var settled = await customers.TrySettleCancellationRefundAsync(row.Id, charge, storedReason, cancellationToken);
            if (!settled)
            {
                return Result.Failure<OrderCancellationRefundDto>(new Error(
                    "orders.cancel_refund.in_progress",
                    "This refund is already being handled.",
                    ErrorCategory.Validation));
            }

            customers.DetachOrderCancellationRefund(row);
            row.ChargeAmount = charge;
            row.ChargeReason = storedReason;
            row.RefundAmount = 0;
            row.Status = CancellationRefundStatuses.Settled;
            row.ModifiedOnUtc = DateTime.UtcNow;
            await FinishAsync(order, row, adminUserId, cancellationToken);
            return Result.Success(OrderCancellationMapper.ToDto(row));
        }

        var claimed = await customers.TryClaimCancellationRefundAsync(row.Id, charge, storedReason, refund, cancellationToken);
        if (!claimed)
        {
            return Result.Failure<OrderCancellationRefundDto>(new Error(
                "orders.cancel_refund.in_progress",
                "This refund is already being sent.",
                ErrorCategory.Validation));
        }

        customers.DetachOrderCancellationRefund(row);
        row.ChargeAmount = charge;
        row.ChargeReason = storedReason;
        row.RefundAmount = refund;
        row.Status = CancellationRefundStatuses.Refunding;
        row.ModifiedOnUtc = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(manual))
        {
            ApplyPaid(row, OrderRefundMethods.Manual, manual, keepOnlineIds: false);
        }
        else
        {
            var online = await RefundOnlineAsync(order, row, cancellationToken);
            if (online.IsFailure)
            {
                if (row.RefundedOnlineAmount <= 0)
                {
                    row.Status = CancellationRefundStatuses.PendingReview;
                    row.ModifiedOnUtc = DateTime.UtcNow;
                    await customers.UpdateOrderCancellationRefundAsync(row, cancellationToken);
                    await customers.SaveChangesAsync(cancellationToken);
                }

                return Result.Failure<OrderCancellationRefundDto>(online.Errors[0]);
            }
        }

        await FinishAsync(order, row, adminUserId, cancellationToken);
        return Result.Success(OrderCancellationMapper.ToDto(row));
    }

    private async Task FinishAsync(
        CustomerRentalOrder order,
        CustomerOrderCancellationRefund row,
        Guid adminUserId,
        CancellationToken cancellationToken)
    {
        await customers.AddCustomerNotificationAsync(
            new CustomerNotification
            {
                Id = Guid.NewGuid(),
                CustomerId = order.CustomerId,
                RelatedOrderId = order.Id,
                NotificationType = "order_status_updated",
                Title = $"Order {order.OrderNumber} refund",
                Body = CustomerBody(row),
            },
            cancellationToken);

        await vendors.AddAdminAuditLogAsync(
            new AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = adminUserId,
                ActionType = "ADMIN_CANCELLATION_REFUND",
                EntityType = "CustomerOrderCancellationRefund",
                EntityId = row.Id,
                Notes = row.Status == CancellationRefundStatuses.Settled
                    ? $"Closed cancellation refund for {order.OrderNumber} with a charge of {OrderReturnMapper.Money(row.ChargeAmount)} and no refund."
                    : row.RefundMethod == OrderRefundMethods.Razorpay
                        ? $"Refunded {OrderReturnMapper.Money(row.RefundAmount)} for {order.OrderNumber} via Razorpay {row.RazorpayRefundId}."
                        : $"Marked {OrderReturnMapper.Money(row.RefundAmount)} paid for {order.OrderNumber}. Reference: {row.RefundReference}.",
            },
            cancellationToken);

        await customers.UpdateOrderCancellationRefundAsync(row, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);
    }

    private static string CustomerBody(CustomerOrderCancellationRefund row)
    {
        if (row.RefundAmount <= 0)
            return $"A charge of {OrderReturnMapper.Money(row.ChargeAmount)} uses the full payment for this product, so nothing is refunded.";

        if (row.ChargeAmount > 0)
            return $"A charge of {OrderReturnMapper.Money(row.ChargeAmount)} was deducted. Your refund of {OrderReturnMapper.Money(row.RefundAmount)} for this product has been sent.";

        return $"Your refund of {OrderReturnMapper.Money(row.RefundAmount)} for this product has been sent.";
    }

    private async Task<Result> RefundOnlineAsync(
        CustomerRentalOrder order,
        CustomerOrderCancellationRefund row,
        CancellationToken cancellationToken)
    {
        if (!razorpay.IsConfigured)
            return NoOnlinePayment();

        var slices = await LoadSlicesAsync(order, row, cancellationToken);
        var plan = Plan(slices, row.RefundAmount, row.RefundedOnlineAmount);
        var planned = plan.Sum(item => item.Send);
        var remaining = decimal.Round(row.RefundAmount - row.RefundedOnlineAmount, 2, MidpointRounding.AwayFromZero);
        if (remaining <= 0)
        {
            ApplyPaid(row, OrderRefundMethods.Razorpay, row.RazorpayRefundId ?? "razorpay", keepOnlineIds: true);
            return Result.Success();
        }

        if (planned + 0.009m < remaining || plan.Any(item => string.IsNullOrWhiteSpace(item.Slice.PaymentId)))
            return NoOnlinePayment();

        foreach (var item in plan)
        {
            var paise = (long)Math.Round(item.Send * 100m, MidpointRounding.AwayFromZero);
            if (paise < 100)
            {
                return Result.Failure(new Error(
                    "orders.cancel_refund.amount_too_small",
                    "This refund is below ₹1, so the payment provider cannot send it. Mark it paid manually.",
                    ErrorCategory.Validation));
            }
        }

        var sentAny = row.RefundedOnlineAmount > 0;
        foreach (var item in plan)
        {
            var already = await customers.SumRefundedAmountForCheckoutSessionAsync(item.Slice.SessionId, cancellationToken);
            var alreadyOnSlice = AlreadySentOnSlice(slices, item.Slice, row.RefundedOnlineAmount);
            var counted = item.Slice.Refundable == row.OriginalPaidAmount && order.CheckoutSessionId == item.Slice.SessionId
                ? already
                : already + alreadyOnSlice;
            if (counted + item.Send > item.Slice.SessionAmount + 0.009m)
            {
                return Result.Failure(new Error(
                    "orders.cancel_refund.exceeds_payment",
                    "This checkout does not have enough captured payment left for this refund.",
                    ErrorCategory.Validation));
            }

            var paise = (long)Math.Round(item.Send * 100m, MidpointRounding.AwayFromZero);
            try
            {
                var refundId = await razorpay.RefundPaymentAsync(
                    item.Slice.PaymentId,
                    paise,
                    new Dictionary<string, string>
                    {
                        ["orderId"] = order.Id.ToString("N"),
                        ["orderNumber"] = order.OrderNumber,
                        ["purpose"] = "cancellation_refund",
                    },
                    cancellationToken);
                row.RefundedOnlineAmount = decimal.Round(row.RefundedOnlineAmount + item.Send, 2, MidpointRounding.AwayFromZero);
                row.RazorpayRefundId = JoinIds(row.RazorpayRefundId, refundId);
                row.RefundReference = row.RazorpayRefundId;
                row.RazorpayPaymentId ??= item.Slice.PaymentId;
                row.Status = CancellationRefundStatuses.Refunding;
                row.ModifiedOnUtc = DateTime.UtcNow;
                await customers.UpdateOrderCancellationRefundAsync(row, cancellationToken);
                await customers.SaveChangesAsync(cancellationToken);
                sentAny = true;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Cancellation refund failed for order {OrderId}", order.Id);
                return Result.Failure(new Error(
                    "orders.cancel_refund.provider_failed",
                    sentAny
                        ? "Part of this refund was sent. Mark the rest paid with a reference if the customer was already paid."
                        : "The payment provider could not send this refund. Mark it paid manually with a reference.",
                    ErrorCategory.Validation));
            }
        }

        ApplyPaid(row, OrderRefundMethods.Razorpay, row.RazorpayRefundId ?? "razorpay", keepOnlineIds: true);
        return Result.Success();
    }

    private async Task<List<PaymentSlice>> LoadSlicesAsync(
        CustomerRentalOrder order,
        CustomerOrderCancellationRefund row,
        CancellationToken cancellationToken)
    {
        var slices = new List<PaymentSlice>();
        if (row.OriginalPaidAmount > 0 && order.CheckoutSessionId is Guid sessionId)
        {
            var session = await customers.GetCheckoutSessionByIdAsync(sessionId, cancellationToken);
            if (session is not null
                && !session.IsDeleted
                && string.Equals(session.Status, CheckoutSessionStatuses.Paid, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(session.Source, CheckoutSessionSources.RentalExtension, StringComparison.OrdinalIgnoreCase))
            {
                slices.Add(new PaymentSlice(
                    session.Id,
                    session.RazorpayPaymentId ?? string.Empty,
                    row.OriginalPaidAmount,
                    session.Amount));
            }
        }

        if (row.ExtensionPaidAmount > 0)
        {
            var sessions = await customers.GetPaidExtensionSessionsAsync(order.Id, cancellationToken);
            foreach (var session in sessions)
            {
                slices.Add(new PaymentSlice(
                    session.Id,
                    session.RazorpayPaymentId ?? string.Empty,
                    session.Amount,
                    session.Amount));
            }
        }

        return slices;
    }

    private static List<PlannedSlice> Plan(IReadOnlyList<PaymentSlice> slices, decimal refundAmount, decimal alreadySent)
    {
        var plan = new List<PlannedSlice>();
        decimal cursor = 0;
        var need = refundAmount - alreadySent;
        foreach (var slice in slices)
        {
            var alreadyInSlice = Math.Max(0, Math.Min(slice.Refundable, alreadySent - cursor));
            var room = slice.Refundable - alreadyInSlice;
            var send = Math.Min(Math.Max(0, room), Math.Max(0, need));
            send = decimal.Round(send, 2, MidpointRounding.AwayFromZero);
            if (send > 0)
                plan.Add(new PlannedSlice(slice, send));
            need -= send;
            cursor += slice.Refundable;
            if (need <= 0.009m)
                break;
        }

        return plan;
    }

    private static decimal AlreadySentOnSlice(IReadOnlyList<PaymentSlice> slices, PaymentSlice target, decimal alreadySent)
    {
        decimal cursor = 0;
        foreach (var slice in slices)
        {
            if (slice.SessionId == target.SessionId)
                return Math.Max(0, Math.Min(slice.Refundable, alreadySent - cursor));
            cursor += slice.Refundable;
        }

        return 0;
    }

    private static void ApplyPaid(CustomerOrderCancellationRefund row, string method, string reference, bool keepOnlineIds)
    {
        row.Status = CancellationRefundStatuses.Refunded;
        row.RefundMethod = method;
        row.RefundReference = TrimReference(reference);
        if (!keepOnlineIds && method == OrderRefundMethods.Manual)
        {
            row.RazorpayRefundId ??= null;
        }

        row.RefundedAt = DateTimeOffset.UtcNow;
        row.ModifiedOnUtc = DateTime.UtcNow;
    }

    private static string? JoinIds(string? current, string next)
    {
        if (string.IsNullOrWhiteSpace(next))
            return current;
        if (string.IsNullOrWhiteSpace(current))
            return TrimReference(next);
        return TrimReference($"{current}, {next.Trim()}");
    }

    private static string TrimReference(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= 240 ? trimmed : trimmed[..240];
    }

    private static Result NoOnlinePayment() =>
        Result.Failure(new Error(
            "orders.cancel_refund.no_online_payment",
            "This order has no online payment to refund. Mark the refund paid with a reference.",
            ErrorCategory.Validation));

    private sealed record PaymentSlice(Guid SessionId, string PaymentId, decimal Refundable, decimal SessionAmount);

    private sealed record PlannedSlice(PaymentSlice Slice, decimal Send);
}
