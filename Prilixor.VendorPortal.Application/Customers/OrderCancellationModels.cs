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
        var map = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync([dto.Id], cancellationToken);
        return map.TryGetValue(dto.Id, out var row) ? dto with { CancellationRefund = row } : dto;
    }

    public static async Task<List<CustomerOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<CustomerOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var map = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync(items.ConvertAll(i => i.Id), cancellationToken);
        if (map.Count == 0)
            return items;

        return items
            .Select(i => map.TryGetValue(i.Id, out var row) ? i with { CancellationRefund = row } : i)
            .ToList();
    }

    public static async Task<AdminOrderDto> AttachAsync(
        ICustomerRepository customers,
        AdminOrderDto dto,
        CancellationToken cancellationToken)
    {
        var map = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync([dto.OrderId], cancellationToken);
        return map.TryGetValue(dto.OrderId, out var row) ? dto with { CancellationRefund = row } : dto;
    }

    public static async Task<List<AdminOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<AdminOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var map = await customers.GetOrderCancellationRefundDtosByOrderIdsAsync(items.ConvertAll(i => i.OrderId), cancellationToken);
        if (map.Count == 0)
            return items;

        return items
            .Select(i => map.TryGetValue(i.OrderId, out var row) ? i with { CancellationRefund = row } : i)
            .ToList();
    }
}
