using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Onboarding;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorsQuery() : IQuery<List<VendorDto>>;

internal sealed class GetVendorsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorsQuery, List<VendorDto>>
{
    public async Task<Result<List<VendorDto>>> Handle(GetVendorsQuery request, CancellationToken cancellationToken)
    {
        var vendors = await repository.GetVendorsAsync(cancellationToken);
        var result = vendors.Select(v => new VendorDto(
            v.Id.ToString(),
            v.Email,
            v.EmailVerified,
            v.AccountStatus,
            v.RegistrationStage,
            v.LastLoginAt
        )).ToList();

        return Result.Success(result);
    }
}
