using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record BackfillProductImageThumbnailsResult(
    int CatalogExamined,
    int CatalogThumbnailsCreated,
    int CatalogSkipped,
    int CatalogFailed,
    int ListingExamined,
    int ListingThumbnailsCreated,
    int ListingSkipped,
    int ListingFailed,
    bool MoreRemaining);

public sealed record BackfillProductImageThumbnailsCommand(int Limit = 50, DateTime? RebuildBeforeUtc = null)
    : ICommand<BackfillProductImageThumbnailsResult>;

public sealed class BackfillProductImageThumbnailsCommandValidator : AbstractValidator<BackfillProductImageThumbnailsCommand>
{
    public BackfillProductImageThumbnailsCommandValidator()
    {
        RuleFor(x => x.Limit).InclusiveBetween(1, 500);
    }
}

/// <summary>
/// Prod-safe batch job: generate missing thumbnails for existing catalog/listing images in S3 (or local).
/// Call repeatedly until <see cref="BackfillProductImageThumbnailsResult.MoreRemaining"/> is false.
/// </summary>
internal sealed class BackfillProductImageThumbnailsCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorUploadStorageService uploadStorage)
    : ICommandHandler<BackfillProductImageThumbnailsCommand, BackfillProductImageThumbnailsResult>
{
    public async Task<Result<BackfillProductImageThumbnailsResult>> Handle(
        BackfillProductImageThumbnailsCommand request,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.Limit, 1, 500);
        var rebuildBefore = request.RebuildBeforeUtc;

        var catalog = rebuildBefore is null
            ? await repository.GetProductImagesMissingThumbnailsAsync(limit, cancellationToken)
            : await repository.GetProductImagesForFittedThumbnailRebuildAsync(limit, rebuildBefore.Value, cancellationToken);
        var catalogCreated = 0;
        var catalogSkipped = 0;
        var catalogFailed = 0;

        foreach (var image in catalog)
        {
            try
            {
                var thumbRef = await uploadStorage.CreateThumbnailForExistingImageAsync(
                    image.ImageUrl,
                    cancellationToken,
                    fitSquare: true);
                if (string.IsNullOrWhiteSpace(thumbRef))
                {
                    // Mark as processed so small/already-optimized images are not retried forever.
                    image.ThumbnailUrl = image.ImageUrl;
                    if (rebuildBefore is not null)
                        image.ModifiedOnUtc = DateTime.UtcNow;
                    await repository.UpdateProductImageAsync(image, cancellationToken);
                    catalogSkipped++;
                    continue;
                }

                image.ThumbnailUrl = thumbRef;
                if (rebuildBefore is not null)
                    image.ModifiedOnUtc = DateTime.UtcNow;
                await repository.UpdateProductImageAsync(image, cancellationToken);
                catalogCreated++;
            }
            catch
            {
                if (rebuildBefore is not null)
                {
                    image.ModifiedOnUtc = DateTime.UtcNow;
                    await repository.UpdateProductImageAsync(image, cancellationToken);
                }
                catalogFailed++;
            }
        }

        var listing = rebuildBefore is null
            ? await repository.GetVendorProductImagesMissingThumbnailsAsync(limit, cancellationToken)
            : await repository.GetVendorProductImagesForFittedThumbnailRebuildAsync(limit, rebuildBefore.Value, cancellationToken);
        var listingCreated = 0;
        var listingSkipped = 0;
        var listingFailed = 0;

        foreach (var image in listing)
        {
            try
            {
                var thumbRef = await uploadStorage.CreateThumbnailForExistingImageAsync(
                    image.ImageUrl,
                    cancellationToken,
                    fitSquare: true);
                if (string.IsNullOrWhiteSpace(thumbRef))
                {
                    image.ThumbnailUrl = image.ImageUrl;
                    if (rebuildBefore is not null)
                        image.ModifiedOnUtc = DateTime.UtcNow;
                    await repository.UpdateVendorProductImageAsync(image, cancellationToken);
                    listingSkipped++;
                    continue;
                }

                image.ThumbnailUrl = thumbRef;
                if (rebuildBefore is not null)
                    image.ModifiedOnUtc = DateTime.UtcNow;
                await repository.UpdateVendorProductImageAsync(image, cancellationToken);
                listingCreated++;
            }
            catch
            {
                if (rebuildBefore is not null)
                {
                    image.ModifiedOnUtc = DateTime.UtcNow;
                    await repository.UpdateVendorProductImageAsync(image, cancellationToken);
                }
                listingFailed++;
            }
        }

        await repository.SaveChangesAsync(cancellationToken);

        var moreCatalog = rebuildBefore is null
            ? (await repository.GetProductImagesMissingThumbnailsAsync(1, cancellationToken)).Count > 0
            : (await repository.GetProductImagesForFittedThumbnailRebuildAsync(1, rebuildBefore.Value, cancellationToken)).Count > 0;
        var moreListing = rebuildBefore is null
            ? (await repository.GetVendorProductImagesMissingThumbnailsAsync(1, cancellationToken)).Count > 0
            : (await repository.GetVendorProductImagesForFittedThumbnailRebuildAsync(1, rebuildBefore.Value, cancellationToken)).Count > 0;

        return Result.Success(new BackfillProductImageThumbnailsResult(
            catalog.Count,
            catalogCreated,
            catalogSkipped,
            catalogFailed,
            listing.Count,
            listingCreated,
            listingSkipped,
            listingFailed,
            moreCatalog || moreListing));
    }
}
