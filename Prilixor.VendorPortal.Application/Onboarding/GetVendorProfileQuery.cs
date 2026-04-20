using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorProfileQuery(string VendorId) : IQuery<VendorProfileDto>;

internal sealed class GetVendorProfileQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorProfileQuery, VendorProfileDto>
{
    public async Task<Result<VendorProfileDto>> Handle(GetVendorProfileQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorProfileDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);
        if (profile is null)
        {
            return Result.Failure<VendorProfileDto>(new Error("vendor_profiles.not_found", "Vendor profile not found.", ErrorCategory.NotFound));
        }

        return Result.Success(new VendorProfileDto(
            profile.Id.ToString(),
            profile.VendorId.ToString(),
            profile.BusinessName,
            profile.OwnerName,
            profile.SupportPhone,
            profile.GstNumber,
            profile.AddressLine1,
            profile.AddressLine2,
            profile.City,
            profile.State,
            profile.PostalCode,
            profile.Latitude,
            profile.Longitude,
            profile.OnboardingCompleted));
    }
}
