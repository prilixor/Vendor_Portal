using FluentValidation;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record UpsertVendorAvailabilityOverrideCommand(
    string VendorId,
    DateOnly OverrideDate,
    bool IsAvailable,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Reason) : ICommand<VendorAvailabilityOverrideDto>;

public sealed class UpsertVendorAvailabilityOverrideCommandValidator : AbstractValidator<UpsertVendorAvailabilityOverrideCommand>
{
    public UpsertVendorAvailabilityOverrideCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(255);
        RuleFor(x => x)
            .Must(x => !x.IsAvailable || (x.StartTime is not null && x.EndTime is not null && x.StartTime < x.EndTime))
            .WithMessage("When isAvailable is true, startTime and endTime are required and startTime must be less than endTime.");
        RuleFor(x => x)
            .Must(x => x.IsAvailable || (x.StartTime is null && x.EndTime is null))
            .WithMessage("When isAvailable is false, startTime and endTime must be null.");
    }
}

internal sealed class UpsertVendorAvailabilityOverrideCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpsertVendorAvailabilityOverrideCommand, VendorAvailabilityOverrideDto>
{
    public async Task<Result<VendorAvailabilityOverrideDto>> Handle(UpsertVendorAvailabilityOverrideCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
        {
            return Result.Failure<VendorAvailabilityOverrideDto>(new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        if (vendor is null)
        {
            return Result.Failure<VendorAvailabilityOverrideDto>(new Error("vendors.not_found", "Vendor not found.", ErrorCategory.NotFound));
        }

        var row = await repository.GetVendorAvailabilityOverrideByDateAsync(vendorId, request.OverrideDate, cancellationToken)
                  ?? new VendorAvailabilityOverride
                  {
                      VendorId = vendorId,
                      OverrideDate = request.OverrideDate
                  };

        row.IsAvailable = request.IsAvailable;
        row.StartTime = request.StartTime;
        row.EndTime = request.EndTime;
        row.Reason = request.Reason;
        row.IsDeleted = false;
        row.DeletedAt = null;
        row.DeletedBy = null;

        await repository.UpsertVendorAvailabilityOverrideAsync(row, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new VendorAvailabilityOverrideDto(
            row.Id.ToString(),
            row.VendorId.ToString(),
            row.OverrideDate,
            row.IsAvailable,
            row.StartTime,
            row.EndTime,
            row.Reason));
    }
}
