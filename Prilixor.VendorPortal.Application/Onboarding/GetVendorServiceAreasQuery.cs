using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorServiceAreasQuery(string VendorId) : IQuery<List<VendorServiceAreaDto>>;

internal sealed class GetVendorServiceAreasQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorServiceAreasQuery, List<VendorServiceAreaDto>>
{
    public async Task<Result<List<VendorServiceAreaDto>>> Handle(GetVendorServiceAreasQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorServiceAreaDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorServiceAreasAsync(vendorId, cancellationToken);
        var result = rows.Select(entity => new VendorServiceAreaDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.AreaName,
            entity.City,
            entity.CenterLatitude,
            entity.CenterLongitude,
            entity.ServiceRadiusKm,
            entity.IsActive,
            entity.IsRadiusSetByAdmin)).ToList();

        return Result.Success(result);
    }
}
