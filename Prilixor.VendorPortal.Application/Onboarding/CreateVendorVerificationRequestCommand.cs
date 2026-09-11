using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Legal;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record CreateVendorVerificationRequestCommand(string VendorId) : ICommand<VendorVerificationRequestDto>;

public sealed class CreateVendorVerificationRequestCommandValidator : AbstractValidator<CreateVendorVerificationRequestCommand>
{
    public CreateVendorVerificationRequestCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
    }
}

internal sealed class CreateVendorVerificationRequestCommandHandler(
    IVendorOnboardingRepository repository,
    ILegalAcceptanceRecorder legalAcceptances)
    : ICommandHandler<CreateVendorVerificationRequestCommand, VendorVerificationRequestDto>
{
    public async Task<Result<VendorVerificationRequestDto>> Handle(CreateVendorVerificationRequestCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorVerificationRequestDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorVerificationRequestDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var signed = await legalAcceptances.HasAcceptedCurrentDocumentAsync(
            LegalCatalog.ActorTypes.Vendor,
            vendorId,
            LegalCatalog.DocumentTypes.VendorSellerPolicy,
            cancellationToken,
            requireSignedName: true);
        if (!signed)
        {
            return Result.Failure<VendorVerificationRequestDto>(new Error(
                "legal.signature_required",
                "Type your full name to electronically sign the Vendor / Seller Policy before submitting.",
                ErrorCategory.Validation));
        }

        var verificationRequest = new VendorVerificationRequest
        {
            VendorId = vendorId,
            ReviewStatus = "pending",
            SubmittedAt = DateTimeOffset.UtcNow
        };

        await repository.AddVerificationRequestAsync(verificationRequest, cancellationToken);
        vendor.RegistrationStage = "under_review";
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorVerificationRequestDto(
            verificationRequest.Id.ToString(),
            verificationRequest.VendorId.ToString(),
            verificationRequest.ReviewStatus,
            verificationRequest.SubmittedAt,
            verificationRequest.ReviewedAt,
            verificationRequest.ReviewedBy?.ToString(),
            verificationRequest.RejectionReason));
    }
}
