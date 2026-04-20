using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorWorkingHoursQuery(string VendorId) : IQuery<List<VendorWorkingHourDto>>;

internal sealed class GetVendorWorkingHoursQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorWorkingHoursQuery, List<VendorWorkingHourDto>>
{
    public async Task<Result<List<VendorWorkingHourDto>>> Handle(GetVendorWorkingHoursQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorWorkingHourDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var rows = await repository.GetVendorWorkingHoursAsync(vendorId, cancellationToken);
        var result = rows.Select(x => new VendorWorkingHourDto(
            x.Id.ToString(),
            x.VendorId.ToString(),
            x.DayOfWeek,
            x.IsOpen,
            x.OpenTime,
            x.CloseTime)).ToList();

        return Result.Success(result);
    }
}
