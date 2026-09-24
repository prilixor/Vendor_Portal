using FluentValidation;
using MediatR;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record AdminCustomerListItemDto(
    string Id,
    string Email,
    string FullName,
    string? Phone,
    bool IsEmailVerified,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    int OrderCount);

public sealed record AdminCustomerDetailDto(
    string Id,
    string Email,
    string FullName,
    string? Phone,
    bool IsEmailVerified,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<AdminCustomerAddressDto> Addresses,
    IReadOnlyList<AdminCustomerOrderSummaryDto> RecentOrders,
    int OrderCount);

public sealed record AdminCustomerAddressDto(
    string Id,
    string? Label,
    string Line1,
    string City,
    string State,
    string Postal,
    bool IsDefault);

public sealed record AdminCustomerOrderSummaryDto(
    string Id,
    string OrderNumber,
    string Status,
    decimal TotalAmount,
    DateTimeOffset CreatedAt,
    string? PlacedByAdminId);

public sealed record GetAdminCustomersQuery(string? Search, int Page = 1, int PageSize = 50)
    : IQuery<List<AdminCustomerListItemDto>>;

internal sealed class GetAdminCustomersQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminCustomersQuery, List<AdminCustomerListItemDto>>
{
    public async Task<Result<List<AdminCustomerListItemDto>>> Handle(GetAdminCustomersQuery request, CancellationToken cancellationToken)
    {
        var rows = await customers.SearchCustomersForAdminAsync(request.Search, request.Page, request.PageSize, cancellationToken);
        return Result.Success(rows);
    }
}

public sealed class AdminCustomerListResult
{
    public List<AdminCustomerListItemDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetAdminCustomerListQuery(
    string? Search,
    int Page = 1,
    int PageSize = 8) : IQuery<AdminCustomerListResult>;

public sealed class GetAdminCustomerListQueryValidator : AbstractValidator<GetAdminCustomerListQuery>
{
    public GetAdminCustomerListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminCustomerListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminCustomerListQuery, AdminCustomerListResult>
{
    public async Task<Result<AdminCustomerListResult>> Handle(
        GetAdminCustomerListQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        // Same DbContext — do not run these in parallel.
        var totalCount = await customers.CountCustomersForAdminAsync(request.Search, cancellationToken);
        var items = await customers.SearchCustomersForAdminAsync(request.Search, page, pageSize, cancellationToken);

        return Result.Success(new AdminCustomerListResult
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }
}

public sealed record GetAdminCustomerDetailQuery(Guid CustomerId, int OrdersPage = 1, int OrdersPageSize = 10)
    : IQuery<AdminCustomerDetailDto>;

internal sealed class GetAdminCustomerDetailQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminCustomerDetailQuery, AdminCustomerDetailDto>
{
    public async Task<Result<AdminCustomerDetailDto>> Handle(GetAdminCustomerDetailQuery request, CancellationToken cancellationToken)
    {
        var detail = await customers.GetCustomerDetailForAdminAsync(
            request.CustomerId, request.OrdersPage, request.OrdersPageSize, cancellationToken);
        if (detail is null)
            return Result.Failure<AdminCustomerDetailDto>(new Error("customers.not_found", "Customer not found.", ErrorCategory.NotFound));
        return Result.Success(detail);
    }
}

public sealed record AdminOrderableListingDto(
    string ListingId,
    string VendorId,
    string ProductId,
    string Title,
    string VendorName,
    string CategoryName,
    bool IsChemical,
    bool IsRentEnabled,
    bool IsBuyEnabled,
    decimal DailyRent,
    decimal WeeklyRent,
    decimal MonthlyRent,
    decimal SecurityDeposit,
    decimal? BuyPrice,
    decimal? MaxBuyPrice,
    int AvailableQuantity,
    string AvailabilityStatus,
    string ListingStatus,
    string? PrimaryImageUrl,
    bool PrescriptionRequired = false);

public sealed record GetAdminOrderableListingsQuery(string? Search, int Take = 40, bool? IsChemical = null)
    : IQuery<List<AdminOrderableListingDto>>;

internal sealed class GetAdminOrderableListingsQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminOrderableListingsQuery, List<AdminOrderableListingDto>>
{
    public async Task<Result<List<AdminOrderableListingDto>>> Handle(
        GetAdminOrderableListingsQuery request, CancellationToken cancellationToken)
    {
        var take = request.Take <= 0 ? 40 : Math.Min(request.Take, 100);
        var rows = await customers.SearchOrderableListingsForAdminAsync(
            request.Search, take, request.IsChemical, cancellationToken);
        return Result.Success(rows);
    }
}

public sealed record AdminPlaceCustomerOrdersCommand(
    Guid AdminUserId,
    Guid CustomerId,
    Guid? CustomerAddressId,
    string DeliveryOption,
    IReadOnlyList<CartLineRequest> Lines) : ICommand<PlaceCustomerOrdersResultDto>;

public sealed class AdminPlaceCustomerOrdersCommandValidator : AbstractValidator<AdminPlaceCustomerOrdersCommand>
{
    public AdminPlaceCustomerOrdersCommandValidator()
    {
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.DeliveryOption).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Lines).NotEmpty();
    }
}

internal sealed class AdminPlaceCustomerOrdersCommandHandler(
    IMediator mediator,
    IVendorOnboardingRepository vendors)
    : ICommandHandler<AdminPlaceCustomerOrdersCommand, PlaceCustomerOrdersResultDto>
{
    public async Task<Result<PlaceCustomerOrdersResultDto>> Handle(AdminPlaceCustomerOrdersCommand request, CancellationToken cancellationToken)
    {
        var placeResult = await mediator.Send(new PlaceCustomerOrdersCommand(
            request.CustomerId,
            request.CustomerAddressId,
            request.DeliveryOption,
            request.Lines,
            request.AdminUserId), cancellationToken);

        if (!placeResult.IsSuccess)
            return placeResult;

        await vendors.AddAdminAuditLogAsync(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminId = request.AdminUserId,
            ActionType = "CUSTOMER_ORDER_PLACED_BY_ADMIN",
            EntityType = "Customer",
            EntityId = request.CustomerId,
            Notes = $"Placed {placeResult.Value.PlacedOrders.Count} order(s); failed={placeResult.Value.FailedLines.Count}"
        }, cancellationToken);
        await vendors.SaveChangesAsync(cancellationToken);

        return placeResult;
    }
}
