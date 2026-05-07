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

internal sealed class AddVendorDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
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

        // Check if a document of the same type already exists for this vendor
        var existingDocuments = await repository.GetVendorDocumentsAsync(vendorId, cancellationToken);
        var existingDoc = existingDocuments.FirstOrDefault(d => d.DocumentType == request.DocumentType);
        if (existingDoc is not null)
        {
            return Result.Failure<VendorDocumentDto>(new Error("vendors.document_duplicate", "This document is already uploaded. Please delete the existing file before uploading a new one.", ErrorCategory.Validation));
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
        
        // Only change registration stage to documents_pending if vendor is not already active
        if (vendor.AccountStatus != "active")
        {
            vendor.RegistrationStage = "documents_pending";
        }
        
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorDocumentDto(
            doc.Id.ToString(),
            doc.VendorId.ToString(),
            doc.DocumentType,
            fileUrlResolver.Resolve(doc.FileUrl),
            doc.DocumentNumber,
            doc.VerificationStatus,
            doc.RejectionReason,
            doc.VerifiedAt));
    }
}
