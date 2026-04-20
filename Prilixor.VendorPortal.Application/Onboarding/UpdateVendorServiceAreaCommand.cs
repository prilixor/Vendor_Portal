using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpdateVendorServiceAreaCommand(
    string VendorId,
    string ServiceAreaId,
    string AreaName,
    string City,
    decimal CenterLatitude,
    decimal CenterLongitude,
    decimal ServiceRadiusKm,
    bool IsActive) : ICommand<VendorServiceAreaDto>;

public sealed class UpdateVendorServiceAreaCommandValidator : AbstractValidator<UpdateVendorServiceAreaCommand>
{
    public UpdateVendorServiceAreaCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ServiceAreaId).NotEmpty();
        RuleFor(x => x.AreaName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ServiceRadiusKm).GreaterThan(0);
    }
}

internal sealed class UpdateVendorServiceAreaCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateVendorServiceAreaCommand, VendorServiceAreaDto>
{
    public async Task<Result<VendorServiceAreaDto>> Handle(UpdateVendorServiceAreaCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        if (!Guid.TryParse(request.ServiceAreaId, out var serviceAreaId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendor_service_areas.invalid_id", "Service area id must be a valid UUID.", ErrorCategory.Validation));
        }

        var entity = await repository.GetVendorServiceAreaByIdAsync(vendorId, serviceAreaId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendor_service_areas.not_found", "Service area not found.", ErrorCategory.NotFound));
        }

        entity.AreaName = request.AreaName;
        entity.City = request.City;
        entity.CenterLatitude = request.CenterLatitude;
        entity.CenterLongitude = request.CenterLongitude;
        entity.ServiceRadiusKm = request.ServiceRadiusKm;
        entity.IsActive = request.IsActive;

        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorServiceAreaDto(
            entity.Id.ToString(),
            entity.VendorId.ToString(),
            entity.AreaName,
            entity.City,
            entity.CenterLatitude,
            entity.CenterLongitude,
            entity.ServiceRadiusKm,
            entity.IsActive));
    }
}
