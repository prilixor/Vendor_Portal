using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorAvailabilityOverridesQuery(string VendorId) : IQuery<List<VendorAvailabilityOverrideDto>>;

internal sealed class GetVendorAvailabilityOverridesQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorAvailabilityOverridesQuery, List<VendorAvailabilityOverrideDto>>
{
    public async Task<Result<List<VendorAvailabilityOverrideDto>>> Handle(GetVendorAvailabilityOverridesQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorAvailabilityOverrideDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorAvailabilityOverridesAsync(vendorId, cancellationToken);
        var result = rows.Select(x => new VendorAvailabilityOverrideDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.OverrideDate,
            x.IsAvailable,
            x.StartTime,
            x.EndTime,
            x.Reason)).ToList();

        return Result.Success(result);
    }
}
