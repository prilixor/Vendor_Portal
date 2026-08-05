using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetRentalDurationMastersQuery(bool ActiveOnly = false) : IQuery<List<RentalDurationMasterDto>>;

internal sealed class GetRentalDurationMastersQueryHandler(IVendorOnboardingRepository repository)
    : IQueryHandler<GetRentalDurationMastersQuery, List<RentalDurationMasterDto>>
{
    public async Task<Result<List<RentalDurationMasterDto>>> Handle(
        GetRentalDurationMastersQuery request,
        CancellationToken cancellationToken)
    {
        var rows = await repository.GetRentalDurationMastersAsync(request.ActiveOnly, cancellationToken);
        return Result.Success(rows.Select(ToDto).ToList());
    }

    private static RentalDurationMasterDto ToDto(RentalDurationMaster x) =>
        new(x.Id.ToString(), x.DurationLabel, x.DurationDays, x.SortOrder, x.IsActive, x.BillingCycles);
}

public sealed record CreateRentalDurationMasterCommand(
    string DurationLabel,
    int DurationDays,
    int SortOrder,
    bool IsActive,
    decimal BillingCycles) : ICommand<RentalDurationMasterDto>;

public sealed class CreateRentalDurationMasterCommandValidator : AbstractValidator<CreateRentalDurationMasterCommand>
{
    public CreateRentalDurationMasterCommandValidator()
    {
        RuleFor(x => x.DurationLabel).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DurationDays).GreaterThan(0);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BillingCycles).GreaterThan(0);
    }
}

internal sealed class CreateRentalDurationMasterCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<CreateRentalDurationMasterCommand, RentalDurationMasterDto>
{
    public async Task<Result<RentalDurationMasterDto>> Handle(
        CreateRentalDurationMasterCommand request,
        CancellationToken cancellationToken)
    {
        var label = request.DurationLabel.Trim();
        var existing = await repository.GetRentalDurationMastersAsync(activeOnly: false, cancellationToken);
        if (existing.Any(x => x.DurationDays == request.DurationDays))
        {
            return Result.Failure<RentalDurationMasterDto>(new Error(
                "rental_duration.days_exists",
                $"A duration with {request.DurationDays} days already exists.",
                ErrorCategory.Validation));
        }

        var billingCycles = request.BillingCycles > 0
            ? request.BillingCycles
            : decimal.Round(request.DurationDays / 28m, 2, MidpointRounding.AwayFromZero);

        var entity = new RentalDurationMaster
        {
            Id = Guid.CreateVersion7(),
            DurationLabel = label,
            DurationDays = request.DurationDays,
            BillingCycles = billingCycles,
            SortOrder = request.SortOrder,
            IsActive = request.IsActive,
        };

        await repository.AddRentalDurationMasterAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new RentalDurationMasterDto(
            entity.Id.ToString(),
            entity.DurationLabel,
            entity.DurationDays,
            entity.SortOrder,
            entity.IsActive,
            entity.BillingCycles));
    }
}

public sealed record UpdateRentalDurationMasterCommand(
    string Id,
    string DurationLabel,
    int DurationDays,
    int SortOrder,
    bool IsActive,
    decimal BillingCycles) : ICommand<RentalDurationMasterDto>;

public sealed class UpdateRentalDurationMasterCommandValidator : AbstractValidator<UpdateRentalDurationMasterCommand>
{
    public UpdateRentalDurationMasterCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.DurationLabel).NotEmpty().MaximumLength(100);
        RuleFor(x => x.DurationDays).GreaterThan(0);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
        RuleFor(x => x.BillingCycles).GreaterThan(0);
    }
}

internal sealed class UpdateRentalDurationMasterCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<UpdateRentalDurationMasterCommand, RentalDurationMasterDto>
{
    public async Task<Result<RentalDurationMasterDto>> Handle(
        UpdateRentalDurationMasterCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var id))
        {
            return Result.Failure<RentalDurationMasterDto>(new Error(
                "rental_duration.invalid_id",
                "Duration id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var entity = await repository.GetRentalDurationMasterByIdAsync(id, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<RentalDurationMasterDto>(new Error(
                "rental_duration.not_found",
                "Rental duration not found.",
                ErrorCategory.NotFound));
        }

        var others = await repository.GetRentalDurationMastersAsync(activeOnly: false, cancellationToken);
        if (others.Any(x => x.Id != id && x.DurationDays == request.DurationDays))
        {
            return Result.Failure<RentalDurationMasterDto>(new Error(
                "rental_duration.days_exists",
                $"A duration with {request.DurationDays} days already exists.",
                ErrorCategory.Validation));
        }

        entity.DurationLabel = request.DurationLabel.Trim();
        entity.DurationDays = request.DurationDays;
        entity.BillingCycles = request.BillingCycles > 0
            ? request.BillingCycles
            : decimal.Round(request.DurationDays / 28m, 2, MidpointRounding.AwayFromZero);
        entity.SortOrder = request.SortOrder;
        entity.IsActive = request.IsActive;

        await repository.UpdateRentalDurationMasterAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);

        return Result.Success(new RentalDurationMasterDto(
            entity.Id.ToString(),
            entity.DurationLabel,
            entity.DurationDays,
            entity.SortOrder,
            entity.IsActive,
            entity.BillingCycles));
    }
}

public sealed record DeleteRentalDurationMasterCommand(string Id) : ICommand;

public sealed class DeleteRentalDurationMasterCommandValidator : AbstractValidator<DeleteRentalDurationMasterCommand>
{
    public DeleteRentalDurationMasterCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

internal sealed class DeleteRentalDurationMasterCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteRentalDurationMasterCommand>
{
    public async Task<Result> Handle(DeleteRentalDurationMasterCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var id))
        {
            return Result.Failure(new Error(
                "rental_duration.invalid_id",
                "Duration id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var entity = await repository.GetRentalDurationMasterByIdAsync(id, cancellationToken);
        if (entity is null)
        {
            return Result.Failure(new Error(
                "rental_duration.not_found",
                "Rental duration not found.",
                ErrorCategory.NotFound));
        }

        await repository.DeleteRentalDurationMasterAsync(id, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
