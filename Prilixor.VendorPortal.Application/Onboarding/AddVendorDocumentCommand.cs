using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AddVendorDocumentCommand(
    string VendorId,
    string DocumentType,
    string FileUrl,
    string? DocumentNumber) : ICommand<VendorDocumentDto>;

public sealed class AddVendorDocumentCommandValidator : AbstractValidator<AddVendorDocumentCommand>
{
    public AddVendorDocumentCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.DocumentType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.FileUrl).NotEmpty().MaximumLength(2000);
    }
}

internal sealed class AddVendorDocumentCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<AddVendorDocumentCommand, VendorDocumentDto>
{
    public async Task<Result<VendorDocumentDto>> Handle(AddVendorDocumentCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var doc = new VendorDocument
        {
            VendorId = vendorId,
            DocumentType = request.DocumentType,
            FileUrl = request.FileUrl,
            DocumentNumber = request.DocumentNumber,
            VerificationStatus = "pending"
        };

        await repository.AddVendorDocumentAsync(doc, cancellationToken);
        vendor.RegistrationStage = "documents_pending";
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorDocumentDto(
            doc.Id.ToString(),
            doc.VendorId.ToString(),
            doc.DocumentType,
            doc.FileUrl,
            doc.DocumentNumber,
            doc.VerificationStatus,
            doc.RejectionReason,
            doc.VerifiedAt));
    }
}
