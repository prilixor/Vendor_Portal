using System.Globalization;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record OrderReturnDto(
    decimal DepositAmount,
    decimal DamageAmount,
    string? DamageReason,
    decimal RefundAmount,
    string Status,
    DateTimeOffset? RefundedAt,
    string? RefundReference,
    bool HasOnlinePayment,
    IReadOnlyList<string> DamageImageUrls);

public sealed record PendingDepositRefundRow(
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    decimal RefundAmount,
    decimal DamageAmount,
    decimal DepositAmount,
    DateTime CreatedOnUtc);

public static class OrderReturnMapper
{
    public static OrderReturnDto ToDto(
        CustomerOrderReturn row,
        bool hasOnlinePayment,
        IReadOnlyList<string>? damageImageUrls = null) =>
        new(
            row.DepositAmount,
            row.DamageAmount,
            string.IsNullOrWhiteSpace(row.DamageReason) ? null : row.DamageReason.Trim(),
            row.RefundAmount,
            row.Status,
            row.RefundedAt,
            string.IsNullOrWhiteSpace(row.RefundReference) ? null : row.RefundReference.Trim(),
            hasOnlinePayment,
            damageImageUrls ?? []);

    public static async Task<CustomerOrderDto> AttachAsync(
        ICustomerRepository customers,
        CustomerOrderDto dto,
        CancellationToken cancellationToken)
    {
        var map = await customers.GetOrderReturnDtosByOrderIdsAsync([dto.Id], cancellationToken);
        return map.TryGetValue(dto.Id, out var row) ? dto with { ReturnSettlement = row } : dto;
    }

    public static async Task<List<CustomerOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<CustomerOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var map = await customers.GetOrderReturnDtosByOrderIdsAsync(items.ConvertAll(i => i.Id), cancellationToken);
        if (map.Count == 0)
            return items;

        return items
            .Select(i => map.TryGetValue(i.Id, out var row) ? i with { ReturnSettlement = row } : i)
            .ToList();
    }

    public static async Task<VendorOrderDto> AttachAsync(
        ICustomerRepository customers,
        VendorOrderDto dto,
        CancellationToken cancellationToken)
    {
        var map = await customers.GetOrderReturnDtosByOrderIdsAsync([dto.OrderId], cancellationToken);
        return map.TryGetValue(dto.OrderId, out var row) ? dto with { ReturnSettlement = row } : dto;
    }

    public static async Task<List<VendorOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<VendorOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var map = await customers.GetOrderReturnDtosByOrderIdsAsync(items.ConvertAll(i => i.OrderId), cancellationToken);
        if (map.Count == 0)
            return items;

        return items
            .Select(i => map.TryGetValue(i.OrderId, out var row) ? i with { ReturnSettlement = row } : i)
            .ToList();
    }

    public static async Task<AdminOrderDto> AttachAsync(
        ICustomerRepository customers,
        AdminOrderDto dto,
        CancellationToken cancellationToken)
    {
        var map = await customers.GetOrderReturnDtosByOrderIdsAsync([dto.OrderId], cancellationToken);
        return map.TryGetValue(dto.OrderId, out var row) ? dto with { ReturnSettlement = row } : dto;
    }

    public static async Task<List<AdminOrderDto>> AttachAsync(
        ICustomerRepository customers,
        List<AdminOrderDto> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return items;

        var map = await customers.GetOrderReturnDtosByOrderIdsAsync(items.ConvertAll(i => i.OrderId), cancellationToken);
        if (map.Count == 0)
            return items;

        return items
            .Select(i => map.TryGetValue(i.OrderId, out var row) ? i with { ReturnSettlement = row } : i)
            .ToList();
    }

    public static string Money(decimal amount)
    {
        var rounded = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        var text = rounded == decimal.Truncate(rounded)
            ? rounded.ToString("0", CultureInfo.InvariantCulture)
            : rounded.ToString("0.00", CultureInfo.InvariantCulture);
        return "₹" + text;
    }
}
