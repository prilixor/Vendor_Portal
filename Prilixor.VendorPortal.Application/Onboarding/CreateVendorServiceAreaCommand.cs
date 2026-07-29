using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record CreateVendorServiceAreaCommand(
    string VendorId,
    string AreaName,
    string City,
    decimal CenterLatitude,
    decimal CenterLongitude,
    decimal ServiceRadiusKm,
    bool IsActive) : ICommand<VendorServiceAreaDto>;

public sealed class CreateVendorServiceAreaCommandValidator : AbstractValidator<CreateVendorServiceAreaCommand>
{
    public CreateVendorServiceAreaCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.AreaName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.CenterLatitude)
            .InclusiveBetween(-90m, 90m)
            .WithMessage("Please set a valid map pin latitude for this service area.");
        RuleFor(x => x.CenterLongitude)
            .InclusiveBetween(-180m, 180m)
            .WithMessage("Please set a valid map pin longitude for this service area.");
        RuleFor(x => x.ServiceRadiusKm)
            .GreaterThan(0)
            .LessThanOrEqualTo(500)
            .WithMessage("Service radius must be between 0 and 500 km.");
        RuleFor(x => x)
            .Must(x => !(x.CenterLatitude == 0m && x.CenterLongitude == 0m))
            .WithErrorCode("vendors.service_area.location_required")
            .WithMessage("Place the pin on the map (search, click, or drag) before saving this service area.");
    }
}

internal sealed class CreateVendorServiceAreaCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateVendorServiceAreaCommand, VendorServiceAreaDto>
{
    public async Task<Result<VendorServiceAreaDto>> Handle(CreateVendorServiceAreaCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorServiceAreaDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        if (request.CenterLatitude == 0m && request.CenterLongitude == 0m)
        {
            return Result.Failure<VendorServiceAreaDto>(new Error(
                "vendors.service_area.location_required",
                "Place the pin on the map (search, click, or drag) before saving this service area.",
                ErrorCategory.Validation));
        }

        var entity = new VendorServiceArea
        {
            VendorId = vendorId,
            AreaName = request.AreaName,
            City = request.City,
            CenterLatitude = request.CenterLatitude,
            CenterLongitude = request.CenterLongitude,
            ServiceRadiusKm = request.ServiceRadiusKm,
            IsActive = request.IsActive
        };

        await repository.AddVendorServiceAreaAsync(entity, cancellationToken);
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
