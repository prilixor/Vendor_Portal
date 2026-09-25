using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Customers;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed class CustomerOrderListQuerySpec
{
    public Guid CustomerId { get; init; }
    public string? Search { get; init; }
    public string? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed class CustomerOrderListResult
{
    public List<CustomerOrderDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public Dictionary<string, int> StatusCounts { get; init; } = [];
}

public sealed record GetCustomerOrderListQuery(
    Guid CustomerId,
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 8) : IQuery<CustomerOrderListResult>;

public sealed class GetCustomerOrderListQueryValidator : AbstractValidator<GetCustomerOrderListQuery>
{
    public GetCustomerOrderListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetCustomerOrderListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrderListQuery, CustomerOrderListResult>
{
    public async Task<Result<CustomerOrderListResult>> Handle(
        GetCustomerOrderListQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);
        var result = await customers.SearchCustomerOrderSummariesAsync(
            new CustomerOrderListQuerySpec
            {
                CustomerId = request.CustomerId,
                Search = request.Search,
                Status = request.Status,
                Page = page,
                PageSize = pageSize,
            },
            cancellationToken);
        return Result.Success(result);
    }
}

public sealed record GetCustomerOrderGroupQuery(Guid CustomerId, Guid OrderId) : IQuery<List<CustomerOrderDto>>;

internal sealed class GetCustomerOrderGroupQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerOrderGroupQuery, List<CustomerOrderDto>>
{
    public async Task<Result<List<CustomerOrderDto>>> Handle(
        GetCustomerOrderGroupQuery request,
        CancellationToken cancellationToken)
    {
        var items = await customers.GetCustomerOrderGroupAsync(
            request.CustomerId,
            request.OrderId,
            cancellationToken);
        return Result.Success(items);
    }
}

public sealed class CustomerNotificationListResult
{
    public List<CustomerNotificationDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int UnreadCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetCustomerNotificationListQuery(
    Guid CustomerId,
    int Page = 1,
    int PageSize = 15) : IQuery<CustomerNotificationListResult>;

public sealed class GetCustomerNotificationListQueryValidator : AbstractValidator<GetCustomerNotificationListQuery>
{
    public GetCustomerNotificationListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetCustomerNotificationListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerNotificationListQuery, CustomerNotificationListResult>
{
    public async Task<Result<CustomerNotificationListResult>> Handle(
        GetCustomerNotificationListQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);
        var result = await customers.SearchCustomerNotificationSummariesAsync(
            request.CustomerId,
            page,
            pageSize,
            cancellationToken);
        return Result.Success(result);
    }
}

public sealed record GetCustomerUnreadNotificationCountQuery(Guid CustomerId) : IQuery<int>;

internal sealed class GetCustomerUnreadNotificationCountQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerUnreadNotificationCountQuery, int>
{
    public async Task<Result<int>> Handle(
        GetCustomerUnreadNotificationCountQuery request,
        CancellationToken cancellationToken)
    {
        var count = await customers.CountUnreadCustomerNotificationsAsync(request.CustomerId, cancellationToken);
        return Result.Success(count);
    }
}

public sealed class CustomerDashboardActivityDto
{
    public string Status { get; init; } = string.Empty;
    public string OrderNumber { get; init; } = string.Empty;
    public string ListingTitle { get; init; } = string.Empty;
}

public sealed class CustomerDashboardSummaryDto
{
    public int ActiveRentals { get; init; }
    public decimal ActiveTotal { get; init; }
    public int UpcomingDeliveries { get; init; }
    public int InStockListings { get; init; }
    public int OutOfStockListings { get; init; }
    public List<CustomerDashboardActivityDto> RecentActivity { get; init; } = [];
}

public sealed record GetCustomerDashboardSummaryQuery(Guid CustomerId) : IQuery<CustomerDashboardSummaryDto>;

internal sealed class GetCustomerDashboardSummaryQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerDashboardSummaryQuery, CustomerDashboardSummaryDto>
{
    public async Task<Result<CustomerDashboardSummaryDto>> Handle(
        GetCustomerDashboardSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var result = await customers.GetCustomerDashboardSummaryAsync(request.CustomerId, cancellationToken);
        return Result.Success(result);
    }
}

public sealed class CustomerExpirationGroupDto
{
    public string BaseOrderNumber { get; init; } = string.Empty;
    public List<ExpiringOrderDto> Items { get; init; } = [];
}

public sealed class CustomerExpirationListResult
{
    public List<CustomerExpirationGroupDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetCustomerExpirationListQuery(
    Guid CustomerId,
    int WithinDays = 30,
    int Page = 1,
    int PageSize = 8) : IQuery<CustomerExpirationListResult>;

public sealed class GetCustomerExpirationListQueryValidator : AbstractValidator<GetCustomerExpirationListQuery>
{
    public GetCustomerExpirationListQueryValidator()
    {
        RuleFor(x => x.WithinDays).InclusiveBetween(1, 60);
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetCustomerExpirationListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerExpirationListQuery, CustomerExpirationListResult>
{
    public async Task<Result<CustomerExpirationListResult>> Handle(
        GetCustomerExpirationListQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);
        var days = Math.Clamp(request.WithinDays, 1, 60);
        var result = await customers.SearchCustomerExpirationSummariesAsync(
            request.CustomerId,
            days,
            page,
            pageSize,
            cancellationToken);

        var dueSoon = result.Items.SelectMany(g => g.Items).Where(i => i.DaysLeft <= 3).ToList();
        if (dueSoon.Count > 0)
        {
            var ids = dueSoon.Select(i => i.OrderId).Distinct().ToList();
            var existing = await customers.GetExistingExpiringNotificationOrderIdsAsync(
                request.CustomerId,
                ids,
                cancellationToken);
            foreach (var row in dueSoon)
            {
                if (existing.Contains(row.OrderId))
                    continue;
                await customers.AddCustomerNotificationAsync(
                    new CustomerNotification
                    {
                        Id = Guid.NewGuid(),
                        CustomerId = request.CustomerId,
                        Title = $"Order {row.OrderNumber} expires in {row.DaysLeft} day(s)",
                        Body = $"Your {row.OrderType} item \"{row.ListingTitle}\" is due on {row.EndDate:dd MMM yyyy}.",
                        NotificationType = CustomerNotificationTypes.OrderExpiringSoon,
                        RelatedOrderId = row.OrderId,
                    },
                    cancellationToken);
                existing.Add(row.OrderId);
            }

            await customers.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(result);
    }
}
