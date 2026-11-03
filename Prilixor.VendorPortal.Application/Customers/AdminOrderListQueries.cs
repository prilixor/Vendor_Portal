using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record GetAdminOrderListQuery(
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 8,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null) : IQuery<AdminOrderListResult>;

public sealed class GetAdminOrderListQueryValidator : AbstractValidator<GetAdminOrderListQuery>
{
    public GetAdminOrderListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminOrderListQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetAdminOrderListQuery, AdminOrderListResult>
{
    public async Task<Result<AdminOrderListResult>> Handle(
        GetAdminOrderListQuery request,
        CancellationToken cancellationToken)
    {
        var fromUtc = ToUtc(request.From);
        var toUtc = ToUtc(request.To);
        if (fromUtc.HasValue && toUtc.HasValue && fromUtc > toUtc)
            (fromUtc, toUtc) = (toUtc, fromUtc);

        var result = await customers.SearchAdminOrderSummariesAsync(
            new AdminOrderListQuerySpec
            {
                Search = request.Search,
                Status = request.Status,
                Page = request.Page,
                PageSize = request.PageSize,
                FromUtc = fromUtc,
                ToUtc = toUtc,
            },
            cancellationToken);

        return Result.Success(result);
    }

    private static DateTime? ToUtc(DateTimeOffset? value) =>
        value is null ? null : DateTime.SpecifyKind(value.Value.UtcDateTime, DateTimeKind.Utc);
}
