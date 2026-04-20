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
        RuleFor(x => x.ServiceRadiusKm).GreaterThan(0);
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
