using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorByIdQuery(string VendorId) : IQuery<VendorDto>;

internal sealed class GetVendorByIdQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorByIdQuery, VendorDto>
{
    public async Task<Result<VendorDto>> Handle(GetVendorByIdQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        return Result.Success(new VendorDto(
            vendor.Id.ToString(),
            vendor.Email,
            vendor.IsEmailVerified,
            vendor.VerificationTokenExpiryUtc,
            vendor.AccountStatus,
            vendor.RegistrationStage,
            vendor.LastLoginAt));
    }
}
