using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminVendorListQuery(
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 9) : IQuery<AdminVendorListResult>;

public sealed class GetAdminVendorListQueryValidator : AbstractValidator<GetAdminVendorListQuery>
{
    public GetAdminVendorListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminVendorListQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminVendorListQuery, AdminVendorListResult>
{
    public async Task<Result<AdminVendorListResult>> Handle(
        GetAdminVendorListQuery request,
        CancellationToken cancellationToken)
    {
        var result = await repository.SearchVendorSummariesAsync(
            new AdminVendorListQuerySpec
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
