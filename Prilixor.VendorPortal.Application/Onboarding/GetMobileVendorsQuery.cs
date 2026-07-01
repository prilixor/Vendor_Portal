using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Extensions;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetMobileVendorsQuery(int Page = 1, int PageSize = 20) : IQuery<PagedResult<VendorDto>>;

internal sealed class GetMobileVendorsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetMobileVendorsQuery, PagedResult<VendorDto>>
{
    public async Task<Result<PagedResult<VendorDto>>> Handle(GetMobileVendorsQuery request, CancellationToken cancellationToken)
    {
        var vendors = await repository.GetVendorsAsync(cancellationToken);
        
        var totalCount = vendors.Count;
        var pagedVendors = vendors
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(v => new VendorDto(
                v.Id.ToString(),
                v.Email,
                v.IsEmailVerified,
                v.VerificationTokenExpiryUtc.ToSafeDateTimeOffset(),
                v.AccountStatus,
                v.RegistrationStage,
                v.LastLoginAt.ToSafeDateTimeOffset(),
                v.TermsAcceptedAt.ToSafeDateTimeOffset(),
                v.CreatedOnUtc.ToSafeDateTimeOffset()
            )).ToList();

        var result = new PagedResult<VendorDto>(pagedVendors, totalCount, request.Page, request.PageSize);
        return Result.Success(result);
    }
}
