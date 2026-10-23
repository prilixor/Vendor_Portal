using System.Text.Json;
using Microsoft.Extensions.Logging;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ReturnDamagePhoto(string FileName, string? ContentType, byte[] Bytes);

public static class OrderReturns
{
    public const int ReasonMaxLength = 500;
    public const int MaxDamageImages = 3;
    public const long MaxDamageImageBytes = 5 * 1024 * 1024;

    public static bool IsDamagePhoto(string? contentType, string? fileName)
    {
        if (CustomerOrderImageRules.IsAllowedContentType(contentType))
            return true;
        var ext = Path.GetExtension(fileName ?? string.Empty);
        return ext.Equals(".jpg", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".png", StringComparison.OrdinalIgnoreCase)
            || ext.Equals(".webp", StringComparison.OrdinalIgnoreCase);
    }

    public static string? SerializeImagePaths(IReadOnlyList<string>? paths)
    {
        if (paths is null || paths.Count == 0)
            return null;
        return JsonSerializer.Serialize(paths);
    }

    public static List<string> ReadImagePaths(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored))
            return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(stored)?
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Select(path => path.Trim())
                .Take(MaxDamageImages)
                .ToList() ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// Opens the one return row for this product. An existing row is left unchanged.
    /// Buy orders are skipped. Damage cannot exceed this product's security deposit.
    /// </summary>
    public static async Task<Result<CustomerOrderReturn?>> TryOpenAsync(
        ICustomerRepository customers,
        CustomerRentalOrder order,
        decimal damageAmount,
        string? damageReason,
        CancellationToken cancellationToken,
        IReadOnlyList<string>? damageImagePaths = null)
    {
        if (string.Equals(order.OrderType, "buy", StringComparison.OrdinalIgnoreCase))
            return Result.Success<CustomerOrderReturn?>(null);

        var existing = await customers.GetOrderReturnByOrderIdAsync(order.Id, cancellationToken);
        if (existing is not null)
            return Result.Success<CustomerOrderReturn?>(existing);

        var damage = decimal.Round(damageAmount, 2, MidpointRounding.AwayFromZero);
        if (damage < 0)
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.damage_negative",
                "Damage charge cannot be negative.",
                ErrorCategory.Validation));
        }

        var deposit = decimal.Round(order.DepositAmount, 2, MidpointRounding.AwayFromZero);
        if (damage > deposit)
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.damage_exceeds_deposit",
                $"Damage charge cannot be more than this product's security deposit of {OrderReturnMapper.Money(deposit)}.",
                ErrorCategory.Validation));
        }

        var reason = damageReason?.Trim();
        if (damage > 0 && string.IsNullOrWhiteSpace(reason))
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.reason_required",
                "Add a short reason for the damage charge.",
                ErrorCategory.Validation));
        }

        if (reason is { Length: > ReasonMaxLength })
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.reason_too_long",
                "Keep the damage reason under 500 characters.",
                ErrorCategory.Validation));
        }

        var imagePaths = (damageImagePaths ?? [])
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => path.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (imagePaths.Count > MaxDamageImages)
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.too_many_photos",
                "You can add up to 3 damage photos.",
                ErrorCategory.Validation));
        }

        if (imagePaths.Count > 0 && damage <= 0)
        {
            return Result.Failure<CustomerOrderReturn?>(new Error(
                "orders.return.photos_need_charge",
                "Add a damage charge before uploading photos.",
                ErrorCategory.Validation));
        }

        var refund = deposit - damage;
        var row = new CustomerOrderReturn
        {
            Id = Guid.NewGuid(),
            CustomerRentalOrderId = order.Id,
            DepositAmount = deposit,
            DamageAmount = damage,
            DamageReason = damage > 0 ? reason : null,
            DamageImagePaths = damage > 0 ? SerializeImagePaths(imagePaths) : null,
            RefundAmount = refund,
            Status = refund > 0 ? OrderReturnStatuses.PendingRefund : OrderReturnStatuses.Settled,
        };
        await customers.AddOrderReturnAsync(row, cancellationToken);
        return Result.Success<CustomerOrderReturn?>(row);
    }

    public static string CustomerMessage(CustomerOrderReturn? row)
    {
        if (row is null)
            return "Return completed for your rental order.";

        if (row.RefundAmount <= 0 && row.DamageAmount <= 0)
            return "Return completed. No security deposit is due back on this product.";

        if (row.RefundAmount <= 0)
            return $"Return completed. A damage charge of {OrderReturnMapper.Money(row.DamageAmount)} uses the full security deposit, so no refund is due on this product.";

        if (row.DamageAmount > 0)
            return $"Return completed. Your deposit refund of {OrderReturnMapper.Money(row.RefundAmount)} is with BlinksMed after a damage charge of {OrderReturnMapper.Money(row.DamageAmount)}.";

        return $"Return completed. Your security deposit refund of {OrderReturnMapper.Money(row.RefundAmount)} is with BlinksMed.";
    }
}

public sealed record RefundOrderDepositCommand(string AdminId, Guid OrderId, string? ManualReference) : ICommand<OrderReturnDto>;

internal sealed class RefundOrderDepositCommandHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors,
    IRazorpayPaymentService razorpay,
    ILogger<RefundOrderDepositCommandHandler> logger)
    : ICommandHandler<RefundOrderDepositCommand, OrderReturnDto>
{
    public async Task<Result<OrderReturnDto>> Handle(RefundOrderDepositCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.AdminId, out var adminUserId))
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "admin.invalid_id",
                "Admin user id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var adminUser = await vendors.GetAdminUserByIdAsync(adminUserId, cancellationToken);
        if (adminUser is null || !adminUser.IsActive)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "admin.not_found",
                "Active admin user not found.",
                ErrorCategory.NotFound));
        }

        var order = await customers.GetCustomerOrderEntityByIdAsync(request.OrderId, cancellationToken);
        if (order is null || order.IsDeleted)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "customers.order_not_found",
                "Order not found.",
                ErrorCategory.NotFound));
        }

        var row = await customers.GetOrderReturnByOrderIdAsync(order.Id, cancellationToken);
        if (row is null)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.not_found",
                "This product has no return to refund.",
                ErrorCategory.NotFound));
        }

        if (row.Status == OrderReturnStatuses.Refunded)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.already_refunded",
                "This deposit was already refunded.",
                ErrorCategory.Validation));
        }

        if (row.RefundAmount <= 0 || row.Status == OrderReturnStatuses.Settled)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.nothing_due",
                "No refund is due on this product.",
                ErrorCategory.Validation));
        }

        var manual = request.ManualReference?.Trim();
        if (manual is { Length: > 120 })
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.reference_too_long",
                "Keep the payment reference under 120 characters.",
                ErrorCategory.Validation));
        }

        if (row.Status == OrderReturnStatuses.Refunding)
        {
            if (string.IsNullOrWhiteSpace(manual))
            {
                return Result.Failure<OrderReturnDto>(new Error(
                    "orders.return.in_progress",
                    "This refund is already being sent. If the customer was already paid, mark it paid with a reference.",
                    ErrorCategory.Validation));
            }

            ApplyPaid(row, OrderRefundMethods.Manual, manual, paymentId: row.RazorpayPaymentId, refundId: row.RazorpayRefundId);
            await FinishRefundAsync(order, row, adminUserId, cancellationToken);
            return Result.Success(OrderReturnMapper.ToDto(row, !string.IsNullOrWhiteSpace(row.RazorpayPaymentId)));
        }

        if (row.Status != OrderReturnStatuses.PendingRefund)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.not_pending",
                "This deposit is not waiting for a refund.",
                ErrorCategory.Validation));
        }

        var claimed = await customers.TryClaimDepositRefundAsync(row.Id, cancellationToken);
        if (!claimed)
        {
            return Result.Failure<OrderReturnDto>(new Error(
                "orders.return.in_progress",
                "This refund is already being sent.",
                ErrorCategory.Validation));
        }

        customers.DetachOrderReturn(row);

        if (!string.IsNullOrWhiteSpace(manual))
        {
            ApplyPaid(row, OrderRefundMethods.Manual, manual, paymentId: null, refundId: null);
        }
        else
        {
            var online = await RefundOnlineAsync(order, row, cancellationToken);
            if (online.IsFailure)
            {
                row.Status = OrderReturnStatuses.PendingRefund;
                row.ModifiedOnUtc = DateTime.UtcNow;
                await customers.UpdateOrderReturnAsync(row, cancellationToken);
                await customers.SaveChangesAsync(cancellationToken);
                return Result.Failure<OrderReturnDto>(online.Errors[0]);
            }
        }

        await FinishRefundAsync(order, row, adminUserId, cancellationToken);
        var hasOnline = row.RefundMethod == OrderRefundMethods.Razorpay
            || !string.IsNullOrWhiteSpace(row.RazorpayPaymentId);
        return Result.Success(OrderReturnMapper.ToDto(row, hasOnline));
    }

    private async Task FinishRefundAsync(
        CustomerRentalOrder order,
        CustomerOrderReturn row,
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
                Title = $"Order {order.OrderNumber} deposit refund",
                Body = $"Your security deposit refund of {OrderReturnMapper.Money(row.RefundAmount)} for this product has been sent.",
            },
            cancellationToken);

        await vendors.AddAdminAuditLogAsync(
            new AdminAuditLog
            {
                Id = Guid.NewGuid(),
                AdminId = adminUserId,
                ActionType = "ADMIN_DEPOSIT_REFUND",
                EntityType = "CustomerOrderReturn",
                EntityId = row.Id,
                Notes = row.RefundMethod == OrderRefundMethods.Razorpay
                    ? $"Refunded deposit {OrderReturnMapper.Money(row.RefundAmount)} for {order.OrderNumber} via Razorpay {row.RazorpayRefundId}."
                    : $"Marked deposit {OrderReturnMapper.Money(row.RefundAmount)} paid for {order.OrderNumber}. Reference: {row.RefundReference}.",
            },
            cancellationToken);

        await customers.UpdateOrderReturnAsync(row, cancellationToken);
        await customers.SaveChangesAsync(cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);
    }

    private async Task<Result> RefundOnlineAsync(
        CustomerRentalOrder order,
        CustomerOrderReturn row,
        CancellationToken cancellationToken)
    {
        if (order.CheckoutSessionId is not Guid sessionId)
            return NoOnlinePayment();

        var session = await customers.GetCheckoutSessionByIdAsync(sessionId, cancellationToken);
        if (session is null
            || session.IsDeleted
            || !string.Equals(session.Status, CheckoutSessionStatuses.Paid, StringComparison.OrdinalIgnoreCase)
            || string.Equals(session.Source, CheckoutSessionSources.RentalExtension, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(session.RazorpayPaymentId))
        {
            return NoOnlinePayment();
        }

        if (!razorpay.IsConfigured)
            return NoOnlinePayment();

        var already = await customers.SumRefundedAmountForCheckoutSessionAsync(session.Id, cancellationToken);
        if (already + row.RefundAmount > session.Amount + 0.009m)
        {
            return Result.Failure(new Error(
                "orders.return.exceeds_payment",
                "This checkout does not have enough captured payment left for this deposit refund.",
                ErrorCategory.Validation));
        }

        var paise = (long)Math.Round(row.RefundAmount * 100m, MidpointRounding.AwayFromZero);
        if (paise < 100)
        {
            return Result.Failure(new Error(
                "orders.return.amount_too_small",
                "This refund is below ₹1, so the payment provider cannot send it. Mark it paid manually.",
                ErrorCategory.Validation));
        }

        try
        {
            var refundId = await razorpay.RefundPaymentAsync(
                session.RazorpayPaymentId,
                paise,
                new Dictionary<string, string>
                {
                    ["orderId"] = order.Id.ToString("N"),
                    ["orderNumber"] = order.OrderNumber,
                    ["purpose"] = "deposit_refund",
                },
                cancellationToken);
            ApplyPaid(row, OrderRefundMethods.Razorpay, refundId, session.RazorpayPaymentId, refundId);
            return Result.Success();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Deposit refund failed for order {OrderId}", order.Id);
            return Result.Failure(new Error(
                "orders.return.provider_failed",
                "The payment provider could not send this refund. Mark it paid manually with a reference.",
                ErrorCategory.Validation));
        }
    }

    private static void ApplyPaid(
        CustomerOrderReturn row,
        string method,
        string reference,
        string? paymentId,
        string? refundId)
    {
        row.Status = OrderReturnStatuses.Refunded;
        row.RefundMethod = method;
        row.RefundReference = reference;
        row.RazorpayPaymentId = paymentId;
        row.RazorpayRefundId = refundId;
        row.RefundedAt = DateTimeOffset.UtcNow;
        row.ModifiedOnUtc = DateTime.UtcNow;
    }

    private static Result NoOnlinePayment() =>
        Result.Failure(new Error(
            "orders.return.no_online_payment",
            "This order has no online payment to refund. Mark the refund paid with a reference.",
            ErrorCategory.Validation));
}
