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

        // Client reload/navigation cancels RequestAborted → OperationCanceledException here.
        // Handled as HTTP 499 by GlobalExceptionHandler (not a data bug).
        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorProfileDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);
        if (profile is null)
        {
            return Result.Success(new VendorProfileDto(
                Guid.Empty.ToString(),
                vendor.Id.ToString(),
                string.Empty,
                string.Empty,
                vendor.SupportPhone,
                null,
                string.Empty,
                null,
                string.Empty,
                string.Empty,
                string.Empty,
                null,
                null,
                false));
        }

        return Result.Success(new VendorProfileDto(
            profile.Id.ToString(),
            profile.VendorId.ToString(),
            profile.BusinessName,
            profile.OwnerName,
            vendor.SupportPhone,
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
