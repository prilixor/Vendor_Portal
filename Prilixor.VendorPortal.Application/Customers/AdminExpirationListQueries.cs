using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed class AdminExpirationListQuerySpec
{
    public int WithinDays { get; init; } = 7;
    public string? Search { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed class AdminExpirationListResult
{
    public List<ExpiringOrderDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public sealed record GetAdminExpirationListQuery(
    int WithinDays = 7,
    string? Search = null,
    int Page = 1,
    int PageSize = 8) : IQuery<AdminExpirationListResult>;

public sealed class GetAdminExpirationListQueryValidator : AbstractValidator<GetAdminExpirationListQuery>
{
    public GetAdminExpirationListQueryValidator()
    {
        RuleFor(x => x.WithinDays).InclusiveBetween(1, 60);
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminExpirationListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminExpirationListQuery, AdminExpirationListResult>
{
    public async Task<Result<AdminExpirationListResult>> Handle(
        GetAdminExpirationListQuery request,
        CancellationToken cancellationToken)
    {
        var result = await customers.SearchAdminExpirationSummariesAsync(
            new AdminExpirationListQuerySpec
            {
                WithinDays = request.WithinDays,
                Search = request.Search,
                Page = request.Page,
                PageSize = request.PageSize,
            },
            cancellationToken);

        return Result.Success(result);
    }
}
