using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record DeleteVendorAvailabilityOverrideCommand(string VendorId, string OverrideId) : ICommand;

public sealed class DeleteVendorAvailabilityOverrideCommandValidator : AbstractValidator<DeleteVendorAvailabilityOverrideCommand>
{
    public DeleteVendorAvailabilityOverrideCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.OverrideId).NotEmpty();
    }
}

internal sealed class DeleteVendorAvailabilityOverrideCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteVendorAvailabilityOverrideCommand>
{
    public async Task<Result> Handle(DeleteVendorAvailabilityOverrideCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.OverrideId, out var overrideId))
        {
            return Result.Failure(new Error("vendors.availability.invalid_id", "Availability override id must be a valid UUID.", ErrorCategory.Validation));
        }

        var row = await repository.GetVendorAvailabilityOverrideByIdAsync(vendorId, overrideId, cancellationToken);
        if (row is null)
        {
            return Result.Failure(new Error("vendors.availability.not_found", "Availability override not found.", ErrorCategory.NotFound));
        }

        row.IsDeleted = true;
        row.DeletedAt = DateTimeOffset.UtcNow;

        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
