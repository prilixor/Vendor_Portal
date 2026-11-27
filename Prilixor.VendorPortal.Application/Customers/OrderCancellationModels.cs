using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record OrderCancellationRefundDto(
    decimal PaidAmount,
    decimal ChargeAmount,
    string? ChargeReason,
    decimal RefundAmount,
    string Status,
    string Outcome,
    string ActorRole,
    string ActorLabel,
    DateTimeOffset? RefundedAt,
    string? RefundReference,
    bool HasOnlinePayment);

/// <summary>Who cancelled an order and why, for every screen. Present for every cancelled order that has a reason.</summary>
public sealed record OrderCancelInfoDto(
    string CancelledBy,
    string Reason,
    string Label,
    DateTimeOffset? CancelledAt,
    /// <summary>True when nothing was paid and the system gave up (payment not completed / checkout failed).</summary>
    bool IsUnpaidAbandonment)
{
    public static OrderCancelInfoDto? FromOrder(CustomerRentalOrder o)
    {
        var status = o.Status?.Trim().ToLowerInvariant();
        if (status is not ("cancelled" or "canceled") || string.IsNullOrWhiteSpace(o.CancelReason))
            return null;
        var label = OrderCancelReasons.Label(o.CancelReason);
        if (label is null)
            return null;
        return new OrderCancelInfoDto(
            string.IsNullOrWhiteSpace(o.CancelledBy) ? CancellationActors.Unknown : o.CancelledBy.Trim().ToLowerInvariant(),
            o.CancelReason.Trim().ToLowerInvariant(),
            label,
            o.CancelledAt,
            OrderCancelReasons.IsUnpaidAbandonment(o.CancelReason));
    }
}

public sealed record PendingCancellationRefundRow(
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    decimal PaidAmount,
    string ActorLabel,
    string Outcome,
    DateTime CreatedOnUtc);

public static class OrderCancellationMapper
{
    public static OrderCancellationRefundDto ToDto(CustomerOrderCancellationRefund row) =>
        new(
            row.PaidAmount,
            row.ChargeAmount,
            string.IsNullOrWhiteSpace(row.ChargeReason) ? null : row.ChargeReason.Trim(),
            row.RefundAmount,
            row.Status,
            row.Outcome,
            row.ActorRole,
            row.ActorLabel,
            row.RefundedAt,
            string.IsNullOrWhiteSpace(row.RefundReference) ? null : row.RefundReference.Trim(),
            row.HasOnlinePayment);

    public static async Task<CustomerOrderDto> AttachAsync(
        ICustomerRepository customers,
        CustomerOrderDto dto,
        CancellationToken cancellationToken)
    {
        var refunds = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync([dto.Id], cancellationToken);
        var info = await customers.GetOrderCancelInfosByOrderIdsAsync([dto.Id], cancellationToken);
        return dto with
        {
            CancellationRefund = refunds.TryGetValue(dto.Id, out var r) ? r : dto.CancellationRefund,
            CancelInfo = info.TryGetValue(dto.Id, out var c) ? c : dto.CancelInfo,
        };
    }

    public static async Task<List<CustomerOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<CustomerOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var ids = items.ConvertAll(i => i.Id);
        var refunds = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync(ids, cancellationToken);
        var info = await customers.GetOrderCancelInfosByOrderIdsAsync(ids, cancellationToken);
        if (refunds.Count == 0 && info.Count == 0)
            return items;

        return items
            .Select(i => i with
            {
                CancellationRefund = refunds.TryGetValue(i.Id, out var r) ? r : i.CancellationRefund,
                CancelInfo = info.TryGetValue(i.Id, out var c) ? c : i.CancelInfo,
            })
            .ToList();
    }

    public static async Task<AdminOrderDto> AttachAsync(
        ICustomerRepository customers,
        AdminOrderDto dto,
        CancellationToken cancellationToken)
    {
        var refunds = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync([dto.OrderId], cancellationToken);
        var info = await customers.GetOrderCancelInfosByOrderIdsAsync([dto.OrderId], cancellationToken);
        return dto with
        {
            CancellationRefund = refunds.TryGetValue(dto.OrderId, out var r) ? r : dto.CancellationRefund,
            CancelInfo = info.TryGetValue(dto.OrderId, out var c) ? c : dto.CancelInfo,
        };
    }

    public static async Task<List<AdminOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<AdminOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var ids = items.ConvertAll(i => i.OrderId);
        var refunds = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync(ids, cancellationToken);
        var info = await customers.GetOrderCancelInfosByOrderIdsAsync(ids, cancellationToken);
        if (refunds.Count == 0 && info.Count == 0)
            return items;

        return items
            .Select(i => i with
            {
                CancellationRefund = refunds.TryGetValue(i.OrderId, out var r) ? r : i.CancellationRefund,
                CancelInfo = info.TryGetValue(i.OrderId, out var c) ? c : i.CancelInfo,
            })
            .ToList();
    }
}
