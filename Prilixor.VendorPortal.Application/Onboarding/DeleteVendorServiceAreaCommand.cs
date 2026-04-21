using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record DeleteVendorServiceAreaCommand(string VendorId, string ServiceAreaId) : ICommand;

public sealed class DeleteVendorServiceAreaCommandValidator : AbstractValidator<DeleteVendorServiceAreaCommand>
{
    public DeleteVendorServiceAreaCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ServiceAreaId).NotEmpty();
    }
}

internal sealed class DeleteVendorServiceAreaCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteVendorServiceAreaCommand>
{
    public async Task<Result> Handle(DeleteVendorServiceAreaCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.ServiceAreaId, out var serviceAreaId))
        {
            return Result.Failure(new Error("vendor_service_areas.invalid_id", "Service area id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetVendorServiceAreaByIdAsync(vendorId, serviceAreaId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure(new Error("vendor_service_areas.not_found", "Service area not found.", ErrorCategory.NotFound));
        }

        entity.IsDeleted = true;
        entity.DeletedAt = DateTimeOffset.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
