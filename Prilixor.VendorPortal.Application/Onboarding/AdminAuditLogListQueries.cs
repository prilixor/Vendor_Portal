using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminAuditLogListQuery(
    string? Search,
    string? AdminUserId,
    int Page = 1,
    int PageSize = 8) : IQuery<AdminAuditLogListResult>;

public sealed class GetAdminAuditLogListQueryValidator : AbstractValidator<GetAdminAuditLogListQuery>
{
    public GetAdminAuditLogListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

internal sealed class GetAdminAuditLogListQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetAdminAuditLogListQuery, AdminAuditLogListResult>
{
    public async Task<Result<AdminAuditLogListResult>> Handle(
        GetAdminAuditLogListQuery request,
        CancellationToken cancellationToken)
    {
        var result = await repository.SearchAdminAuditLogSummariesAsync(
            new AdminAuditLogListQuerySpec
            {
                Search = request.Search,
                AdminUserId = request.AdminUserId,
                Page = request.Page,
                PageSize = request.PageSize,
            },
            cancellationToken);

        return Result.Success(result);
    }
}
