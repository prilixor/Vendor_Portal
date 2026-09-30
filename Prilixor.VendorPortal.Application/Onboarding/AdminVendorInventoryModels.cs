using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AdminVendorInventorySizeDto(
    string Label,
    string Sku,
    int Total,
    int Available);

public sealed record AdminVendorListingInventoryDto(
    string ListingId,
    int TotalQuantity,
    int AvailableQuantity,
    int ReservedQuantity,
    string Source,
    List<AdminVendorInventorySizeDto>? Sizes = null);

public sealed record GetAdminVendorInventorySummariesQuery(string VendorId)
    : IQuery<List<AdminVendorListingInventoryDto>>;

public sealed class GetAdminVendorInventorySummariesQueryValidator
    : AbstractValidator<GetAdminVendorInventorySummariesQuery>
{
    public GetAdminVendorInventorySummariesQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
    }
}

internal sealed class GetAdminVendorInventorySummariesQueryHandler(IVendorOnboardingRepository vendors)
    : IQueryHandler<GetAdminVendorInventorySummariesQuery, List<AdminVendorListingInventoryDto>>
{
    public async Task<Result<List<AdminVendorListingInventoryDto>>> Handle(
        GetAdminVendorInventorySummariesQuery request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId))
            return Result.Failure<List<AdminVendorListingInventoryDto>>(
                new Error("vendors.invalid_id", "Vendor id must be a valid UUID.", ErrorCategory.Validation));

        var listings = await vendors.GetVendorProductListingsAsync(vendorId, cancellationToken);
        var listingIds = listings.Select(l => l.Id).ToList();
        var flats = await vendors.GetVendorInventoriesByListingIdsAsync(listingIds, cancellationToken);
        var variants = await vendors.GetVariantInventoriesByListingIdsAsync(listingIds, cancellationToken);

        var flatByListing = flats.ToDictionary(x => x.VendorProductListingId);
        var variantsByListing = variants
            .GroupBy(x => x.VendorProductListingId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<AdminVendorListingInventoryDto>();
        foreach (var listing in listings)
        {
            if (variantsByListing.TryGetValue(listing.Id, out var variantRows) && variantRows.Count > 0)
            {
                result.Add(new AdminVendorListingInventoryDto(
                    listing.Id.ToString(),
                    variantRows.Sum(r => r.TotalQuantity),
                    variantRows.Sum(r => r.AvailableQuantity),
                    variantRows.Sum(r => r.ReservedQuantity),
                    "variant",
                    variantRows.Select(r => new AdminVendorInventorySizeDto(
                        $"{r.ProductVariant.SizeValue} {r.ProductVariant.SizeUnit}",
                        r.ProductVariant.Sku,
                        r.TotalQuantity,
                        r.AvailableQuantity)).ToList()));
                continue;
            }

            if (flatByListing.TryGetValue(listing.Id, out var flat))
            {
                result.Add(new AdminVendorListingInventoryDto(
                    listing.Id.ToString(),
                    flat.TotalQuantity,
                    flat.AvailableQuantity,
                    flat.ReservedQuantity,
                    "flat"));
            }
        }

        return Result.Success(result);
    }
}
