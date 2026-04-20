using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorVerificationRequestsQuery(string VendorId) : IQuery<List<VendorVerificationRequestDto>>;

internal sealed class GetVendorVerificationRequestsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorVerificationRequestsQuery, List<VendorVerificationRequestDto>>
{
    public async Task<Result<List<VendorVerificationRequestDto>>> Handle(GetVendorVerificationRequestsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorVerificationRequestDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var records = await repository.GetVerificationRequestsAsync(vendorId, cancellationToken);

        var result = records
            .Select(x => new VendorVerificationRequestDto(
                x.Id.ToString(),
                x.VendorId.ToString(),
                x.ReviewStatus,
                x.SubmittedAt,
                x.ReviewedAt,
                x.ReviewedBy?.ToString(),
                x.RejectionReason))
            .ToList();

        return Result.Success(result);
    }
}
