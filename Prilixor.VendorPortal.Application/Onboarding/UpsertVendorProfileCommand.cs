using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorProfileCommand(
    string VendorId,
    string BusinessName,
    string OwnerName,
    string SupportPhone,
    string? GstNumber,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string State,
    string PostalCode,
    decimal? Latitude,
    decimal? Longitude) : ICommand<VendorProfileDto>;

public sealed class UpsertVendorProfileCommandValidator : AbstractValidator<UpsertVendorProfileCommand>
{
    public UpsertVendorProfileCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.BusinessName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.OwnerName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.SupportPhone).NotEmpty().MaximumLength(20);
        RuleFor(x => x.AddressLine1).NotEmpty().MaximumLength(255);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.State).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PostalCode).NotEmpty().MaximumLength(20);
    }
}

internal sealed class UpsertVendorProfileCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorProfileCommand, VendorProfileDto>
{
    public async Task<Result<VendorProfileDto>> Handle(UpsertVendorProfileCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorProfileDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorProfileDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);
        if (profile is null)
        {
            profile = new VendorProfile
            {
                VendorId = vendorId
            };
        }

        profile.BusinessName = request.BusinessName;
        profile.OwnerName = request.OwnerName;
        profile.SupportPhone = request.SupportPhone;
        profile.GstNumber = request.GstNumber;
        profile.AddressLine1 = request.AddressLine1;
        profile.AddressLine2 = request.AddressLine2;
        profile.City = request.City;
        profile.State = request.State;
        profile.PostalCode = request.PostalCode;
        profile.Latitude = request.Latitude;
        profile.Longitude = request.Longitude;

        await repository.UpsertVendorProfileAsync(profile, cancellationToken);

        vendor.RegistrationStage = "profile_pending";
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorProfileDto(
            profile.Id.ToString(),
            profile.VendorId.ToString(),
            profile.BusinessName,
            profile.OwnerName,
            profile.SupportPhone,
            profile.GstNumber,
            profile.AddressLine1,
            profile.AddressLine2,
            profile.City,
            profile.State,
            profile.PostalCode,
            profile.Latitude,
            profile.Longitude,
            profile.OnboardingCompleted));
    }
}
