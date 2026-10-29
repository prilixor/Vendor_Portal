using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminVerificationListQuery(
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 8) : IQuery<AdminVerificationListResult>;

public sealed class GetAdminVerificationListQueryValidator : AbstractValidator<GetAdminVerificationListQuery>
{
    public GetAdminVerificationListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminVerificationListQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminVerificationListQuery, AdminVerificationListResult>
{
    public async Task<Result<AdminVerificationListResult>> Handle(
        GetAdminVerificationListQuery request,
        CancellationToken cancellationToken)
    {
        var result = await repository.SearchVendorVerificationSummariesAsync(
            new AdminVerificationListQuerySpec
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
