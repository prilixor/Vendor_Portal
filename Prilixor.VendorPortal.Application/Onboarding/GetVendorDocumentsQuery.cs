using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetVendorDocumentsQuery(string VendorId) : IQuery<List<VendorDocumentDto>>;

internal sealed class GetVendorDocumentsQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetVendorDocumentsQuery, List<VendorDocumentDto>>
{
    public async Task<Result<List<VendorDocumentDto>>> Handle(GetVendorDocumentsQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<List<VendorDocumentDto>>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var documents = await repository.GetVendorDocumentsAsync(vendorId, cancellationToken);

        var result = documents
            .Select(doc => new VendorDocumentDto(
                doc.Id.ToString(),
                doc.VendorId.ToString(),
                doc.DocumentType,
                doc.FileUrl,
                doc.DocumentNumber,
                doc.VerificationStatus,
                doc.RejectionReason,
                doc.VerifiedAt))
            .ToList();

        return Result.Success(result);
    }
}
