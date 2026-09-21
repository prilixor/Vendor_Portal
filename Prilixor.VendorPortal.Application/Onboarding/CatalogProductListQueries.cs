using FluentValidation;
using Microsoft.Extensions.Options;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetProductListQuery(
    string? Search,
    string? CategoryId,
    string? Status,
    bool FavoritesOnly,
    bool? IsChemical,
    int Page = 1,
    int PageSize = 10) : IQuery<PagedResult<ProductDto>>;

public sealed class GetProductListQueryValidator : AbstractValidator<GetProductListQuery>
{
    public GetProductListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Status)
            .Must(s => string.IsNullOrWhiteSpace(s) || s is "all" or "active" or "inactive")
            .WithMessage("Status must be all, active, or inactive.");
    }
}

internal sealed class GetProductListQueryHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetProductListQuery, PagedResult<ProductDto>>
{
    public async Task<Result<PagedResult<ProductDto>>> Handle(GetProductListQuery request, CancellationToken cancellationToken)
    {
        Guid? categoryId = null;
        if (!string.IsNullOrWhiteSpace(request.CategoryId))
        {
            if (!Guid.TryParse(request.CategoryId, out var parsedCategoryId))
            {
                return Result.Failure<PagedResult<ProductDto>>(new Error(
                    "products.invalid_category_id",
                    "Category id must be a valid UUID.",
                    ErrorCategory.Validation));
            }

            categoryId = parsedCategoryId;
        }

        bool? isActive = request.Status switch
        {
            "active" => true,
            "inactive" => false,
            _ => null
        };

        IReadOnlyCollection<Guid>? restrictToIds = null;
        Dictionary<Guid, int>? favoriteLookup = null;
        if (request.FavoritesOnly)
        {
            favoriteLookup = await customerRepository.GetFavoriteCountsByProductsAsync(cancellationToken);
            restrictToIds = favoriteLookup.Where(kv => kv.Value > 0).Select(kv => kv.Key).ToList();
            if (restrictToIds.Count == 0)
            {
                return Result.Success(new PagedResult<ProductDto>([], 0, request.Page, request.PageSize));
            }
        }

        var result = await repository.SearchProductSummariesAsync(new ProductListQuerySpec
        {
            CategoryId = categoryId,
            Search = request.Search,
            IsActive = isActive,
            ProductIds = restrictToIds,
            IsChemical = request.IsChemical,
            Page = request.Page,
            PageSize = request.PageSize
        }, cancellationToken);

        var pageIds = result.Items.Select(x => x.Id).ToList();
        var favoriteCounts = favoriteLookup
            ?? await customerRepository.GetFavoriteCountsForProductIdsAsync(pageIds, cancellationToken);

        var items = result.Items.Select(row => MapListRow(row, favoriteCounts, fileUrlResolver)).ToList();
        return Result.Success(new PagedResult<ProductDto>(items, result.TotalCount, request.Page, request.PageSize));
    }

    private static ProductDto MapListRow(
        ProductListRow row,
        IReadOnlyDictionary<Guid, int> favoriteCounts,
        IVendorFileUrlResolver fileUrlResolver)
    {
        List<ProductImageDto> images = [];
        if (!string.IsNullOrWhiteSpace(row.PrimaryImageUrl) && row.PrimaryImageId.HasValue)
        {
            images.Add(new ProductImageDto(
                row.PrimaryImageId.Value.ToString(),
                row.Id.ToString(),
                fileUrlResolver.Resolve(row.PrimaryImageUrl),
                row.PrimaryImageDisplayOrder <= 0 ? 1 : row.PrimaryImageDisplayOrder,
                row.PrimaryImageIsPrimary,
                string.IsNullOrWhiteSpace(row.PrimaryThumbnailUrl) ? null : fileUrlResolver.Resolve(row.PrimaryThumbnailUrl)));
        }

        return new ProductDto(
            row.Id.ToString(),
            row.CategoryId.ToString(),
            row.ProductName,
            row.BrandName,
            row.ModelName,
            null,
            null,
            row.DailyRent,
            row.WeeklyRent,
            row.MonthlyRent,
            row.SecurityDeposit,
            row.BuyPrice,
            row.VendorDailyRent,
            row.VendorWeeklyRent,
            row.VendorMonthlyRent,
            row.VendorSecurityDeposit,
            row.VendorBuyPrice,
            row.GstPercent,
            row.IsRentEnabled,
            row.IsBuyEnabled,
            row.IsActive,
            images,
            row.Variants.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList(),
            row.CasNumber,
            row.ChemicalFormula,
            row.PurityPercentage,
            row.MolecularWeight,
            row.BaseUnit,
            null,
            null,
            favoriteCounts.GetValueOrDefault(row.Id, 0),
            [],
            []);
    }
}

public sealed record GetProductQuery(string ProductId) : IQuery<ProductDto>;

public sealed class GetProductQueryValidator : AbstractValidator<GetProductQuery>
{
    public GetProductQueryValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
    }
}

internal sealed class GetProductQueryHandler(
    IVendorOnboardingRepository repository,
    ICustomerRepository customerRepository,
    IVendorFileUrlResolver fileUrlResolver,
    IOptions<RentalPricingOptions> rentalPricingOptions)
    : IQueryHandler<GetProductQuery, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(GetProductQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId))
        {
            return Result.Failure<ProductDto>(new Error(
                "products.invalid_id",
                "Product id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var entity = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<ProductDto>(new Error(
                "products.not_found",
                "Product not found.",
                ErrorCategory.NotFound));
        }

        var favoriteCounts = await customerRepository.GetFavoriteCountsForProductIdsAsync([productId], cancellationToken);
        var liveIcons = RentalDurationIconLiveResolve.ToLookup(
            await repository.GetRentalDurationIconsAsync(activeOnly: false, cancellationToken));
        var durationMasters = await repository.GetRentalDurationMastersAsync(activeOnly: true, cancellationToken);

        return Result.Success(MapProduct(
            entity,
            favoriteCounts.GetValueOrDefault(productId, 0),
            durationMasters,
            rentalPricingOptions.Value,
            fileUrlResolver,
            liveIcons));
    }

    internal static ProductDto MapProduct(
        Product x,
        int favoriteCount,
        IReadOnlyList<RentalDurationMaster> durationMasters,
        RentalPricingOptions pricingOptions,
        IVendorFileUrlResolver fileUrlResolver,
        IReadOnlyDictionary<Guid, RentalDurationIcon> liveIcons)
    {
        return new ProductDto(
            x.Id.ToString(),
            x.CategoryId.ToString(),
            x.ProductName,
            x.BrandName,
            x.ModelName,
            x.ShortDescription,
            x.LongDescription,
            x.DailyRent,
            x.WeeklyRent,
            x.MonthlyRent,
            x.SecurityDeposit,
            x.BuyPrice,
            x.VendorDailyRent,
            x.VendorWeeklyRent,
            x.VendorMonthlyRent,
            x.VendorSecurityDeposit,
            x.VendorBuyPrice,
            x.GstPercent,
            x.IsRentEnabled,
            x.IsBuyEnabled,
            x.IsActive,
            x.ProductImages?.Where(i => !i.IsDeleted).Select(i => new ProductImageDto(
                i.Id.ToString(),
                i.ProductId.ToString(),
                fileUrlResolver.Resolve(i.ImageUrl),
                i.DisplayOrder,
                i.IsPrimary,
                string.IsNullOrWhiteSpace(i.ThumbnailUrl) ? null : fileUrlResolver.Resolve(i.ThumbnailUrl))).ToList() ?? [],
            x.Variants?.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            x.ChemicalProperty?.CasNumber,
            x.ChemicalProperty?.ChemicalFormula,
            x.ChemicalProperty?.PurityPercentage,
            x.ChemicalProperty?.MolecularWeight,
            x.ChemicalProperty?.BaseUnit,
            x.ChemicalProperty?.SdsDocumentUrl,
            x.ChemicalProperty?.CoaDocumentUrl,
            favoriteCount,
            ProductRentalPricingPlanSync.ToProjectedDtos(x, durationMasters, pricingOptions, fileUrlResolver, liveIcons),
            ProductCatalogDocuments.ToDtos(x, fileUrlResolver));
    }
}
