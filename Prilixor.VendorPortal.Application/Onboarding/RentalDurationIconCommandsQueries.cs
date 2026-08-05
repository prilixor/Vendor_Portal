using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetRentalDurationIconsQuery(bool ActiveOnly = false) : IQuery<List<RentalDurationIconDto>>;

internal sealed class GetRentalDurationIconsQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetRentalDurationIconsQuery, List<RentalDurationIconDto>>
{
    public async Task<Result<List<RentalDurationIconDto>>> Handle(
        GetRentalDurationIconsQuery request,
        CancellationToken cancellationToken)
    {
        var rows = await repository.GetRentalDurationIconsAsync(request.ActiveOnly, cancellationToken);
        return Result.Success(rows.Select(x => ToDto(x, fileUrlResolver)).ToList());
    }

    internal static RentalDurationIconDto ToDto(RentalDurationIcon x, IVendorFileUrlResolver fileUrlResolver)
    {
        var imageStorageKey = string.IsNullOrWhiteSpace(x.ImageUrl) ? null : x.ImageUrl.Trim();
        var thumbStorageKey = string.IsNullOrWhiteSpace(x.ThumbnailUrl) ? null : x.ThumbnailUrl.Trim();
        return new(
            x.Id.ToString(),
            x.Name,
            x.ValueTier,
            imageStorageKey is null ? string.Empty : fileUrlResolver.Resolve(imageStorageKey),
            thumbStorageKey is null ? null : fileUrlResolver.Resolve(thumbStorageKey),
            x.SortOrder,
            x.IsActive,
            imageStorageKey,
            thumbStorageKey);
    }
}

public sealed record CreateRentalDurationIconCommand(
    string Name,
    string ValueTier,
    string ImageUrl,
    string? ThumbnailUrl,
    int SortOrder,
    bool IsActive) : ICommand<RentalDurationIconDto>;

public sealed class CreateRentalDurationIconCommandValidator : AbstractValidator<CreateRentalDurationIconCommand>
{
    public CreateRentalDurationIconCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ValueTier).NotEmpty().MaximumLength(32);
        RuleFor(x => x.ImageUrl).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.ThumbnailUrl).MaximumLength(2000).When(x => !string.IsNullOrWhiteSpace(x.ThumbnailUrl));
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

internal sealed class CreateRentalDurationIconCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : ICommandHandler<CreateRentalDurationIconCommand, RentalDurationIconDto>
{
    public async Task<Result<RentalDurationIconDto>> Handle(
        CreateRentalDurationIconCommand request,
        CancellationToken cancellationToken)
    {
        var entity = new RentalDurationIcon
        {
            Id = Guid.CreateVersion7(),
            Name = request.Name.Trim(),
            ValueTier = RentalDurationValueTiers.Normalize(request.ValueTier),
            ImageUrl = request.ImageUrl.Trim(),
            ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl) ? null : request.ThumbnailUrl.Trim(),
            SortOrder = request.SortOrder,
            IsActive = request.IsActive,
        };

        await repository.AddRentalDurationIconAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success(GetRentalDurationIconsQueryHandler.ToDto(entity, fileUrlResolver));
    }
}

public sealed record UpdateRentalDurationIconCommand(
    string Id,
    string Name,
    string ValueTier,
    string ImageUrl,
    string? ThumbnailUrl,
    int SortOrder,
    bool IsActive) : ICommand<RentalDurationIconDto>;

public sealed class UpdateRentalDurationIconCommandValidator : AbstractValidator<UpdateRentalDurationIconCommand>
{
    public UpdateRentalDurationIconCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ValueTier).NotEmpty().MaximumLength(32);
        RuleFor(x => x.ImageUrl).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.ThumbnailUrl).MaximumLength(2000).When(x => !string.IsNullOrWhiteSpace(x.ThumbnailUrl));
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}

internal sealed class UpdateRentalDurationIconCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : ICommandHandler<UpdateRentalDurationIconCommand, RentalDurationIconDto>
{
    public async Task<Result<RentalDurationIconDto>> Handle(
        UpdateRentalDurationIconCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var id))
        {
            return Result.Failure<RentalDurationIconDto>(new Error(
                "rental_icon.invalid_id",
                "Icon id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var entity = await repository.GetRentalDurationIconByIdAsync(id, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<RentalDurationIconDto>(new Error(
                "rental_icon.not_found",
                "Rental duration icon not found.",
                ErrorCategory.NotFound));
        }

        entity.Name = request.Name.Trim();
        entity.ValueTier = RentalDurationValueTiers.Normalize(request.ValueTier);
        entity.ImageUrl = PreferStoredReference(request.ImageUrl, entity.ImageUrl);
        entity.ThumbnailUrl = string.IsNullOrWhiteSpace(request.ThumbnailUrl)
            ? null
            : PreferStoredReference(request.ThumbnailUrl, entity.ThumbnailUrl);
        entity.SortOrder = request.SortOrder;
        entity.IsActive = request.IsActive;

        await repository.UpdateRentalDurationIconAsync(entity, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success(GetRentalDurationIconsQueryHandler.ToDto(entity, fileUrlResolver));
    }

    /// <summary>
    /// Avoid persisting ephemeral browser/presigned URLs when the admin form re-saves a display URL.
    /// </summary>
    private static string PreferStoredReference(string incoming, string? existing)
    {
        var value = (incoming ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            return (existing ?? string.Empty).Trim();

        if (LooksLikeEphemeralBrowserUrl(value) && !string.IsNullOrWhiteSpace(existing))
            return existing.Trim();

        return value;
    }

    private static bool LooksLikeEphemeralBrowserUrl(string value)
    {
        if (!value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // Local disk mode persists absolute /uploads/… URLs — keep those.
        // S3 returns short-lived presigned URLs that must not be written to the DB.
        return value.Contains(".amazonaws.com/", StringComparison.OrdinalIgnoreCase)
            || value.Contains("X-Amz-", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record DeleteRentalDurationIconCommand(string Id) : ICommand;

public sealed class DeleteRentalDurationIconCommandValidator : AbstractValidator<DeleteRentalDurationIconCommand>
{
    public DeleteRentalDurationIconCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

internal sealed class DeleteRentalDurationIconCommandHandler(IVendorOnboardingRepository repository)
    : ICommandHandler<DeleteRentalDurationIconCommand>
{
    public async Task<Result> Handle(DeleteRentalDurationIconCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.Id, out var id))
        {
            return Result.Failure(new Error(
                "rental_icon.invalid_id",
                "Icon id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var entity = await repository.GetRentalDurationIconByIdAsync(id, cancellationToken);
        if (entity is null)
        {
            return Result.Failure(new Error(
                "rental_icon.not_found",
                "Rental duration icon not found.",
                ErrorCategory.NotFound));
        }

        await repository.DeleteRentalDurationIconAsync(id, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
