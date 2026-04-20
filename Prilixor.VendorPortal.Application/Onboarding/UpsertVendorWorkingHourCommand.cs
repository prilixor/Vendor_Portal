using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorWorkingHourCommand(
    string VendorId,
    short DayOfWeek,
    bool IsOpen,
    TimeOnly? OpenTime,
    TimeOnly? CloseTime) : ICommand<VendorWorkingHourDto>;

public sealed class UpsertVendorWorkingHourCommandValidator : AbstractValidator<UpsertVendorWorkingHourCommand>
{
    public UpsertVendorWorkingHourCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.DayOfWeek).InclusiveBetween((short)0, (short)6);
        RuleFor(x => x)
            .Must(x => !x.IsOpen || (x.OpenTime is not null && x.CloseTime is not null && x.OpenTime < x.CloseTime))
            .WithMessage("When isOpen is true, openTime and closeTime are required and openTime must be less than closeTime.");
        RuleFor(x => x)
            .Must(x => x.IsOpen || (x.OpenTime is null && x.CloseTime is null))
            .WithMessage("When isOpen is false, openTime and closeTime must be null.");
    }
}

internal sealed class UpsertVendorWorkingHourCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorWorkingHourCommand, VendorWorkingHourDto>
{
    public async Task<Result<VendorWorkingHourDto>> Handle(UpsertVendorWorkingHourCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorWorkingHourDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorWorkingHourDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var row = await repository.GetVendorWorkingHourByDayAsync(vendorId, request.DayOfWeek, cancellationToken)
                  ?? new VendorWorkingHour
                  {
                      VendorId = vendorId,
                      DayOfWeek = request.DayOfWeek
                  };

        row.IsOpen = request.IsOpen;
        row.OpenTime = request.OpenTime;
        row.CloseTime = request.CloseTime;

        await repository.UpsertVendorWorkingHourAsync(row, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorWorkingHourDto(
            row.Id.ToString(),
            row.VendorId.ToString(),
            row.DayOfWeek,
            row.IsOpen,
            row.OpenTime,
            row.CloseTime));
    }
}
