using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed record GetAdminOrderListQuery(
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 8) : IQuery<AdminOrderListResult>;

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
        var result = await customers.SearchAdminOrderSummariesAsync(
            new AdminOrderListQuerySpec
            {
                Search = request.Search,
                Status = request.Status,
                Page = request.Page,
                PageSize = request.PageSize,
            },
            cancellationToken);

        return Result.Success(result);
    }
}
