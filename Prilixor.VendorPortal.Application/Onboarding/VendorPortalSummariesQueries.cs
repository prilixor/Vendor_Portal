using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class VendorOrderListQuerySpec
{
    public Guid VendorId { get; init; }
    public string? Search { get; init; }
    public string? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed class VendorOrderListResult
{
    public List<VendorOrderDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public Dictionary<string, int> StatusCounts { get; init; } = [];
}

public sealed record GetVendorOrderListQuery(
    string VendorId,
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 8) : IQuery<VendorOrderListResult>;

public sealed class GetVendorOrderListQueryValidator : AbstractValidator<GetVendorOrderListQuery>
{
    public GetVendorOrderListQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetVendorOrderListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorOrderListQuery, VendorOrderListResult>
{
    public async Task<Result<VendorOrderListResult>> Handle(
        GetVendorOrderListQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorOrderListResult>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var result = await customers.SearchVendorOrderSummariesAsync(
            new VendorOrderListQuerySpec
            {
                VendorId = vendorId,
                Search = request.Search,
                Status = request.Status,
                Page = Math.Max(1, request.Page),
                PageSize = Math.Clamp(request.PageSize, 1, 50),
            },
            cancellationToken);
        return Result.Success(result);
    }
}

public sealed record GetVendorOrderGroupQuery(string VendorId, Guid OrderId) : IQuery<List<VendorOrderDto>>;

internal sealed class GetVendorOrderGroupQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorOrderGroupQuery, List<VendorOrderDto>>
{
    public async Task<Result<List<VendorOrderDto>>> Handle(
        GetVendorOrderGroupQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<List<VendorOrderDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var items = await customers.GetVendorOrderGroupAsync(vendorId, request.OrderId, cancellationToken);
        return Result.Success(items);
    }
}

public sealed class VendorExpirationGroupDto
{
    public string BaseOrderNumber { get; init; } = string.Empty;
    public List<ExpiringOrderDto> Items { get; init; } = [];
}

public sealed class VendorExpirationListResult
{
    public List<VendorExpirationGroupDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetVendorExpirationListQuery(
    string VendorId,
    int WithinDays = 7,
    string? Search = null,
    int Page = 1,
    int PageSize = 8) : IQuery<VendorExpirationListResult>;

public sealed class GetVendorExpirationListQueryValidator : AbstractValidator<GetVendorExpirationListQuery>
{
    public GetVendorExpirationListQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.WithinDays).InclusiveBetween(1, 60);
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetVendorExpirationListQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorExpirationListQuery, VendorExpirationListResult>
{
    public async Task<Result<VendorExpirationListResult>> Handle(
        GetVendorExpirationListQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorExpirationListResult>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var days = Math.Clamp(request.WithinDays, 1, 60);
        var result = await customers.SearchVendorExpirationSummariesAsync(
            vendorId,
            days,
            request.Search,
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 50),
            cancellationToken);

        var dueSoon = result.Items.SelectMany(g => g.Items).Where(i => i.DaysLeft <= 3).ToList();
        if (dueSoon.Count > 0)
        {
            var titles = dueSoon
                .Select(i => $"Order {i.OrderNumber} expires in {i.DaysLeft} day(s)")
                .ToList();
            var existing = await vendors.GetExistingVendorExpiringNotificationTitlesAsync(
                vendorId, titles, cancellationToken);
            foreach (var row in dueSoon)
            {
                var title = $"Order {row.OrderNumber} expires in {row.DaysLeft} day(s)";
                if (existing.Contains(title))
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
                existing.Add(title);
            }

            await vendors.SaveChangesAsync(cancellationToken);
        }

        return Result.Success(result);
    }
}

public sealed class VendorNotificationListResult
{
    public List<VendorNotificationDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int UnreadCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetVendorNotificationListQuery(
    string VendorId,
    bool UnreadOnly = false,
    int Page = 1,
    int PageSize = 15) : IQuery<VendorNotificationListResult>;

public sealed class GetVendorNotificationListQueryValidator : AbstractValidator<GetVendorNotificationListQuery>
{
    public GetVendorNotificationListQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetVendorNotificationListQueryHandler(IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorNotificationListQuery, VendorNotificationListResult>
{
    public async Task<Result<VendorNotificationListResult>> Handle(
        GetVendorNotificationListQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorNotificationListResult>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var result = await vendors.SearchVendorNotificationSummariesAsync(
            vendorId,
            request.UnreadOnly,
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 50),
            cancellationToken);
        return Result.Success(result);
    }
}

public sealed class VendorDispatchOfferListResult
{
    public List<VendorDispatchOfferDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int PendingCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public Dictionary<string, int> TypeCounts { get; init; } = [];
}

public sealed record GetVendorDispatchOfferListQuery(
    string VendorId,
    string? Search,
    string? OrderType,
    int Page = 1,
    int PageSize = 8) : IQuery<VendorDispatchOfferListResult>;

public sealed class GetVendorDispatchOfferListQueryValidator : AbstractValidator<GetVendorDispatchOfferListQuery>
{
    public GetVendorDispatchOfferListQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetVendorDispatchOfferListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorDispatchOfferListQuery, VendorDispatchOfferListResult>
{
    public async Task<Result<VendorDispatchOfferListResult>> Handle(
        GetVendorDispatchOfferListQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorDispatchOfferListResult>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var result = await customers.SearchVendorDispatchOfferSummariesAsync(
            vendorId,
            request.Search,
            request.OrderType,
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 50),
            cancellationToken);
        return Result.Success(result);
    }
}

public sealed record GetVendorPendingDispatchOfferCountQuery(string VendorId) : IQuery<int>;

internal sealed class GetVendorPendingDispatchOfferCountQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetVendorPendingDispatchOfferCountQuery, int>
{
    public async Task<Result<int>> Handle(
        GetVendorPendingDispatchOfferCountQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<int>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var count = await customers.CountPendingVendorDispatchOffersAsync(vendorId, cancellationToken);
        return Result.Success(count);
    }
}

public sealed class VendorDashboardListingDto
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public decimal DailyRent { get; init; }
    public int Stock { get; init; }
    public string Status { get; init; } = string.Empty;
}

public sealed class VendorDashboardActivityDto
{
    public string Id { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public string NotificationType { get; init; } = string.Empty;
    public bool Read { get; init; }
}

public sealed class VendorDashboardSummaryDto
{
    public string OwnerName { get; init; } = string.Empty;
    public string BusinessName { get; init; } = string.Empty;
    public bool IsVerified { get; init; }
    public string VerificationMessage { get; init; } = string.Empty;
    public int TotalListings { get; init; }
    public int ActiveListings { get; init; }
    public int InventoryUnits { get; init; }
    public int UnreadNotifications { get; init; }
    public int PendingRequestsCount { get; set; }
    public int ConfirmedOrdersCount { get; set; }
    public int InTransitOrdersCount { get; set; }
    public int DueReturnsCount { get; set; }
    public List<VendorDashboardActivityDto> RecentActivity { get; init; } = [];
    public List<VendorDashboardListingDto> TopListings { get; init; } = [];
}

public sealed class VendorDashboardOrderStats
{
    public int PendingRequestsCount { get; init; }
    public int ConfirmedOrdersCount { get; init; }
    public int InTransitOrdersCount { get; init; }
    public int DueReturnsCount { get; init; }
}

public sealed record GetVendorDashboardSummaryQuery(string VendorId) : IQuery<VendorDashboardSummaryDto>;

internal sealed class GetVendorDashboardSummaryQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorDashboardSummaryQuery, VendorDashboardSummaryDto>
{
    public async Task<Result<VendorDashboardSummaryDto>> Handle(
        GetVendorDashboardSummaryQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorDashboardSummaryDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var catalog = await vendors.GetVendorDashboardCatalogAsync(vendorId, cancellationToken);
        var orders = await customers.GetVendorDashboardOrderStatsAsync(vendorId, cancellationToken);
        catalog.PendingRequestsCount = orders.PendingRequestsCount;
        catalog.ConfirmedOrdersCount = orders.ConfirmedOrdersCount;
        catalog.InTransitOrdersCount = orders.InTransitOrdersCount;
        catalog.DueReturnsCount = orders.DueReturnsCount;
        return Result.Success(catalog);
    }
}

public sealed class VendorListingSummaryDto
{
    public string Id { get; init; } = string.Empty;
    public string ProductId { get; init; } = string.Empty;
    public string ListingTitle { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public decimal DailyRent { get; init; }
    public decimal WeeklyRent { get; init; }
    public decimal MonthlyRent { get; init; }
    public decimal SecurityDeposit { get; init; }
    public int AvailableQuantity { get; init; }
    public int TotalQuantity { get; init; }
    public int ReservedQuantity { get; init; }
    public int RentedQuantity { get; init; }
    public int BlockedQuantity { get; init; }
    public string ListingStatus { get; init; } = string.Empty;
    public bool IsChemical { get; init; }
    public string? PrimaryImageUrl { get; init; }
    public string? PrimaryThumbnailUrl { get; init; }
    public string? BrandName { get; init; }
    public string? ModelName { get; init; }
    public bool HasCustomVendorPricing { get; init; }
    public decimal VendorDailyRent { get; init; }
    public decimal? VendorBuyPrice { get; init; }
    public List<VendorListingVariantPayoutDto> VariantPayouts { get; init; } = [];
}

public sealed class VendorListingVariantPayoutDto
{
    public string VariantId { get; init; } = string.Empty;
    public decimal VendorPrice { get; init; }
}

public sealed class VendorListingListResult
{
    public List<VendorListingSummaryDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalUnits { get; init; }
    public int AvailableUnits { get; init; }
    public int ReservedUnits { get; init; }
    public int RentedUnits { get; init; }
    public int BlockedUnits { get; init; }
    public int EquipmentCount { get; init; }
    public int ChemicalCount { get; init; }
    public int ActiveCount { get; init; }
    public int InactiveCount { get; init; }
    public int DraftCount { get; init; }
}

public sealed record GetVendorListingListQuery(
    string VendorId,
    string? Search,
    string? Status,
    bool? IsChemical,
    int Page = 1,
    int PageSize = 8) : IQuery<VendorListingListResult>;

public sealed class GetVendorListingListQueryValidator : AbstractValidator<GetVendorListingListQuery>
{
    public GetVendorListingListQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
    }
}

internal sealed class GetVendorListingListQueryHandler(IVendorOnboardingRepository vendors)
    : IQueryHandler<GetVendorListingListQuery, VendorListingListResult>
{
    public async Task<Result<VendorListingListResult>> Handle(
        GetVendorListingListQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<VendorListingListResult>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var result = await vendors.SearchVendorListingSummariesAsync(
            vendorId,
            request.Search,
            request.Status,
            request.IsChemical,
            Math.Max(1, request.Page),
            Math.Clamp(request.PageSize, 1, 50),
            cancellationToken);
        return Result.Success(result);
    }
}
