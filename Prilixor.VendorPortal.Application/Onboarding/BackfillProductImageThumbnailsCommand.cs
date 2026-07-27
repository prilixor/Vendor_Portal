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

public sealed record BackfillProductImageThumbnailsCommand(int Limit = 50)
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

        var catalog = await repository.GetProductImagesMissingThumbnailsAsync(limit, cancellationToken);
        var catalogCreated = 0;
        var catalogSkipped = 0;
        var catalogFailed = 0;

        foreach (var image in catalog)
        {
            try
            {
                var thumbRef = await uploadStorage.CreateThumbnailForExistingImageAsync(image.ImageUrl, cancellationToken);
                if (string.IsNullOrWhiteSpace(thumbRef))
                {
                    // Mark as processed so small/already-optimized images are not retried forever.
                    image.ThumbnailUrl = image.ImageUrl;
                    await repository.UpdateProductImageAsync(image, cancellationToken);
                    catalogSkipped++;
                    continue;
                }

                image.ThumbnailUrl = thumbRef;
                await repository.UpdateProductImageAsync(image, cancellationToken);
                catalogCreated++;
            }
            catch
            {
                catalogFailed++;
            }
        }

        var listing = await repository.GetVendorProductImagesMissingThumbnailsAsync(limit, cancellationToken);
        var listingCreated = 0;
        var listingSkipped = 0;
        var listingFailed = 0;

        foreach (var image in listing)
        {
            try
            {
                var thumbRef = await uploadStorage.CreateThumbnailForExistingImageAsync(image.ImageUrl, cancellationToken);
                if (string.IsNullOrWhiteSpace(thumbRef))
                {
                    image.ThumbnailUrl = image.ImageUrl;
                    await repository.UpdateVendorProductImageAsync(image, cancellationToken);
                    listingSkipped++;
                    continue;
                }

                image.ThumbnailUrl = thumbRef;
                await repository.UpdateVendorProductImageAsync(image, cancellationToken);
                listingCreated++;
            }
            catch
            {
                listingFailed++;
            }
        }

        await repository.SaveChangesAsync(cancellationToken);

        var moreCatalog = (await repository.GetProductImagesMissingThumbnailsAsync(1, cancellationToken)).Count > 0;
        var moreListing = (await repository.GetVendorProductImagesMissingThumbnailsAsync(1, cancellationToken)).Count > 0;

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
