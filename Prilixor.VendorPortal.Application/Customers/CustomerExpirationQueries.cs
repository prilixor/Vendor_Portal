using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record ExpiringOrderDto(
    Guid OrderId,
    string OrderNumber,
    string CustomerName,
    string VendorName,
    string ListingTitle,
    string Status,
    string OrderType,
    DateOnly EndDate,
    int DaysLeft);

public sealed record GetCustomerOrderExpirationsQuery(Guid CustomerId, int WithinDays = 7) : IQuery<List<ExpiringOrderDto>>;
public sealed record GetVendorOrderExpirationsQuery(string VendorId, int WithinDays = 7) : IQuery<List<ExpiringOrderDto>>;
public sealed record GetAdminOrderExpirationsQuery(int WithinDays = 7) : IQuery<List<ExpiringOrderDto>>;

internal sealed class GetCustomerOrderExpirationsQueryHandler(
    ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrderExpirationsQuery, List<ExpiringOrderDto>>
{
    public async Task<Result<List<ExpiringOrderDto>>> Handle(GetCustomerOrderExpirationsQuery request, CancellationToken cancellationToken)
    {
        var customer = await customers.GetCustomerByIdAsync(request.CustomerId, cancellationToken);
        if (customer is null || customer.IsDeleted)
            return Result.Failure<List<ExpiringOrderDto>>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));

        var days = Math.Clamp(request.WithinDays, 1, 60);
        var fromDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var toDate = fromDate.AddDays(days);
        var rows = await customers.GetExpiringOrdersForCustomerAsync(request.CustomerId, fromDate, toDate, cancellationToken);
        var list = rows.Select(r => ExpiringOrderMapper.MapDto(r, fromDate)).ToList();

        var existing = await customers.GetCustomerNotificationsAsync(request.CustomerId, cancellationToken);
        var existingKeys = existing
            .Where(x => x.NotificationType == CustomerNotificationTypes.OrderExpiringSoon && x.RelatedOrderId.HasValue)
            .Select(x => x.RelatedOrderId!.Value)
            .ToHashSet();

        foreach (var row in rows.Where(r => r.DaysLeft(fromDate) <= 3))
        {
            if (existingKeys.Contains(row.OrderId))
                continue;

            await customers.AddCustomerNotificationAsync(
                new CustomerNotification
                {
                    Id = Guid.NewGuid(),
                    CustomerId = request.CustomerId,
                    Title = $"Order {row.OrderNumber} expires in {row.DaysLeft(fromDate)} day(s)",
                    Body = $"Your {row.OrderType} item \"{row.ListingTitle}\" is due on {row.EndDate:dd MMM yyyy}.",
                    NotificationType = CustomerNotificationTypes.OrderExpiringSoon,
                    RelatedOrderId = row.OrderId,
                },
                cancellationToken);
        }

        await customers.SaveChangesAsync(cancellationToken);
        return Result.Success(list);
    }
}

internal sealed class GetVendorOrderExpirationsQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorOrderExpirationsQuery, List<ExpiringOrderDto>>
{
    public async Task<Result<List<ExpiringOrderDto>>> Handle(GetVendorOrderExpirationsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<List<ExpiringOrderDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var vendor = await vendors.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null || vendor.IsDeleted)
            return Result.Failure<List<ExpiringOrderDto>>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));

        var days = Math.Clamp(request.WithinDays, 1, 60);
        var fromDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var toDate = fromDate.AddDays(days);
        var rows = await customers.GetExpiringOrdersForVendorAsync(vendorId, fromDate, toDate, cancellationToken);
        var list = rows.Select(r => ExpiringOrderMapper.MapDto(r, fromDate)).ToList();

        var existing = await vendors.GetVendorNotificationsAsync(vendorId, cancellationToken);
        var existingOrderNos = existing
            .Where(x => x.NotificationType == "order_expiring_soon")
            .Select(x => x.Title)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var row in rows.Where(r => r.DaysLeft(fromDate) <= 3))
        {
            var title = $"Order {row.OrderNumber} expires in {row.DaysLeft(fromDate)} day(s)";
            if (existingOrderNos.Contains(title))
                continue;

            await vendors.AddVendorNotificationAsync(
                new VendorNotification
                {
                    VendorId = vendorId,
                    NotificationType = "order_expiring_soon",
                    Title = title,
                    Message = $"{row.ListingTitle} for {row.CustomerName} is due on {row.EndDate:dd MMM yyyy}.",
                    Channel = "in_app",
                    Status = "sent",
                    SentAt = DateTimeOffset.UtcNow,
                },
                cancellationToken);
        }

        await vendors.SaveChangesAsync(cancellationToken);
        return Result.Success(list);
    }
}

internal sealed class GetAdminOrderExpirationsQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetAdminOrderExpirationsQuery, List<ExpiringOrderDto>>
{
    public async Task<Result<List<ExpiringOrderDto>>> Handle(GetAdminOrderExpirationsQuery request, CancellationToken cancellationToken)
    {
        var days = Math.Clamp(request.WithinDays, 1, 60);
        var fromDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var toDate = fromDate.AddDays(days);
        var rows = await customers.GetExpiringOrdersForAdminAsync(fromDate, toDate, cancellationToken);
        var list = rows.Select(r => ExpiringOrderMapper.MapDto(r, fromDate)).ToList();

        var admins = await vendors.GetAdminUsersAsync(cancellationToken);
        var logs = await vendors.GetAdminAuditLogsAsync(null, cancellationToken);
        var existing = logs
            .Where(x => x.ActionType == "order.expiring_soon" && x.EntityId.HasValue)
            .Select(x => x.EntityId!.Value)
            .ToHashSet();

        foreach (var row in rows.Where(r => r.DaysLeft(fromDate) <= 3))
        {
            if (existing.Contains(row.OrderId))
                continue;

            foreach (var admin in admins)
            {
                await vendors.AddAdminAuditLogAsync(
                    new AdminAuditLog
                    {
                        AdminId = admin.Id,
                        ActionType = "order.expiring_soon",
                        EntityType = "customer_rental_order",
                        EntityId = row.OrderId,
                        Notes = $"{row.OrderNumber} ({row.ListingTitle}) expires on {row.EndDate:dd MMM yyyy}",
                    },
                    cancellationToken);
            }
        }

        await vendors.SaveChangesAsync(cancellationToken);
        return Result.Success(list);
    }
}

file static class ExpiringOrderMapper
{
    public static ExpiringOrderDto MapDto(ExpiringOrderAggregate row, DateOnly fromDate) =>
        new(
            row.OrderId,
            row.OrderNumber,
            row.CustomerName,
            row.VendorName,
            row.ListingTitle,
            row.Status,
            row.OrderType,
            row.EndDate,
            row.DaysLeft(fromDate));

    public static int DaysLeft(this ExpiringOrderAggregate row, DateOnly fromDate) =>
        Math.Max(0, row.EndDate.DayNumber - fromDate.DayNumber);
}
