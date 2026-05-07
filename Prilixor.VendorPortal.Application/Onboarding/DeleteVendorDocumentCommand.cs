using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record DeleteVendorDocumentCommand(string VendorId, string DocumentId) : ICommand;

public sealed class DeleteVendorDocumentCommandValidator : AbstractValidator<DeleteVendorDocumentCommand>
{
    public DeleteVendorDocumentCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.DocumentId).NotEmpty();
    }
}

internal sealed class DeleteVendorDocumentCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<DeleteVendorDocumentCommand>
{
    public async Task<Result> Handle(DeleteVendorDocumentCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.DocumentId, out var documentId))
        {
            return Result.Failure(new Error("vendors.documents.invalid_id", "Document id must be a valid UUID.", ErrorCategory.Validation));
        }

        var document = await repository.GetVendorDocumentByIdAsync(vendorId, documentId, cancellationToken);
        if (document is null)
        {
            return Result.Failure(new Error("vendors.documents.not_found", "Document not found.", ErrorCategory.NotFound));
        }

        await uploadStorage.DeleteStoredFileAsync(document.FileUrl, cancellationToken);

        document.IsDeleted = true;
        document.DeletedAt = DateTimeOffset.UtcNow;

        await repository.UpdateVendorDocumentAsync(document, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
