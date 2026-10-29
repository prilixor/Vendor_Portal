using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record VendorListingVariantPricingDto(
    string VariantId,
    string Sku,
    decimal SizeValue,
    string SizeUnit,
    bool IsActive,
    decimal CatalogBuyPrice,
    decimal CatalogVendorPrice,
    decimal BuyPrice,
    decimal VendorPrice);

public sealed record VendorListingPricingDto(
    string ListingId,
    string VendorId,
    string VendorName,
    string ProductId,
    string ProductName,
    string? BrandName,
    string? ModelName,
    string CategoryName,
    bool IsChemical,
    string ListingStatus,
    int AvailableQuantity,
    string? ImageUrl,
    bool IsRentEnabled,
    bool IsBuyEnabled,
    bool IsCustomPricing,
    decimal CatalogDailyRent,
    decimal CatalogSecurityDeposit,
    decimal? CatalogBuyPrice,
    decimal CatalogVendorDailyRent,
    decimal? CatalogVendorBuyPrice,
    decimal DailyRent,
    decimal SecurityDeposit,
    decimal? BuyPrice,
    decimal VendorDailyRent,
    decimal? VendorBuyPrice,
    List<VendorListingVariantPricingDto> Variants);

public sealed record GetVendorListingPricingQuery(string VendorId, string ListingId) : IQuery<VendorListingPricingDto>;

public sealed class GetVendorListingPricingQueryValidator : AbstractValidator<GetVendorListingPricingQuery>
{
    public GetVendorListingPricingQueryValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
    }
}

internal sealed class GetVendorListingPricingQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : IQueryHandler<GetVendorListingPricingQuery, VendorListingPricingDto>
{
    public async Task<Result<VendorListingPricingDto>> Handle(GetVendorListingPricingQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "vendors.listing.invalid_id",
                "Vendor and listing ids must be valid UUIDs.",
                ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null || listing.IsDeleted)
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "vendors.listing.not_found",
                "Vendor listing not found.",
                ErrorCategory.NotFound));
        }

        var product = await repository.GetProductByIdAsync(listing.ProductId, cancellationToken);
        if (product is null)
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "products.not_found",
                "Catalog product not found.",
                ErrorCategory.NotFound));
        }

        var vendor = await repository.GetVendorByIdAsync(vendorId, cancellationToken);
        var profile = await repository.GetVendorProfileAsync(vendorId, cancellationToken);
        var vendorName = !string.IsNullOrWhiteSpace(profile?.BusinessName)
            ? profile!.BusinessName!
            : vendor?.Email ?? "Vendor";

        var price = await repository.GetVendorListingPriceOverrideAsync(listingId, cancellationToken);
        var custom = price?.IsCustomPricing == true;
        var variantPrices = price?.Variants.ToDictionary(x => x.ProductVariantId) ?? [];
        var isChemical = product.Category?.IsChemical == true || product.ChemicalProperty != null;

        var image = product.ProductImages
            .Where(i => !i.IsDeleted)
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.DisplayOrder)
            .FirstOrDefault();

        var variants = product.Variants
            .OrderBy(v => v.SizeValue)
            .Select(v =>
            {
                variantPrices.TryGetValue(v.Id, out var row);
                var buy = custom && row is not null ? row.BuyPrice : v.BuyPrice;
                var payout = custom && row is not null ? row.VendorPrice : v.VendorPrice;
                return new VendorListingVariantPricingDto(
                    v.Id.ToString(),
                    v.Sku,
                    v.SizeValue,
                    v.SizeUnit,
                    v.IsActive,
                    v.BuyPrice,
                    v.VendorPrice,
                    buy,
                    payout);
            })
            .ToList();

        return Result.Success(new VendorListingPricingDto(
            listing.Id.ToString(),
            vendorId.ToString(),
            vendorName,
            product.Id.ToString(),
            string.IsNullOrWhiteSpace(product.ProductName) ? listing.ListingTitle : product.ProductName,
            product.BrandName,
            product.ModelName,
            product.Category?.CategoryName ?? "General",
            isChemical,
            listing.ListingStatus,
            listing.AvailableQuantity,
            image is null ? null : fileUrlResolver.Resolve(image.ThumbnailUrl ?? image.ImageUrl),
            product.IsRentEnabled,
            product.IsBuyEnabled,
            custom,
            product.DailyRent,
            product.SecurityDeposit,
            product.BuyPrice,
            product.VendorDailyRent,
            product.VendorBuyPrice,
            VendorListingPriceSnapshot.Rate(custom, price?.DailyRent, product.DailyRent),
            VendorListingPriceSnapshot.Rate(custom, price?.SecurityDeposit, product.SecurityDeposit),
            VendorListingPriceSnapshot.Money(custom, price?.BuyPrice, product.BuyPrice),
            VendorListingPriceSnapshot.Rate(custom, price?.VendorDailyRent, product.VendorDailyRent),
            VendorListingPriceSnapshot.Money(custom, price?.VendorBuyPrice, product.VendorBuyPrice),
            variants));
    }
}

public sealed record SetVendorListingVariantPrice(
    string VariantId,
    decimal BuyPrice,
    decimal VendorPrice);

public sealed record SetVendorListingPricingCommand(
    string VendorId,
    string ListingId,
    Guid ActorAdminId,
    bool IsCustomPricing,
    decimal? DailyRent,
    decimal? SecurityDeposit,
    decimal? BuyPrice,
    decimal? VendorDailyRent,
    decimal? VendorBuyPrice,
    List<SetVendorListingVariantPrice> Variants) : ICommand<VendorListingPricingDto>;

public sealed class SetVendorListingPricingCommandValidator : AbstractValidator<SetVendorListingPricingCommand>
{
    public SetVendorListingPricingCommandValidator()
    {
        RuleFor(x => x.VendorId).NotEmpty();
        RuleFor(x => x.ListingId).NotEmpty();
        RuleFor(x => x.DailyRent).GreaterThanOrEqualTo(0).When(x => x.DailyRent.HasValue);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0).When(x => x.SecurityDeposit.HasValue);
        RuleFor(x => x.BuyPrice).GreaterThanOrEqualTo(0).When(x => x.BuyPrice.HasValue);
        RuleFor(x => x.VendorDailyRent).GreaterThanOrEqualTo(0).When(x => x.VendorDailyRent.HasValue);
        RuleFor(x => x.VendorBuyPrice).GreaterThanOrEqualTo(0).When(x => x.VendorBuyPrice.HasValue);
        RuleForEach(x => x.Variants).ChildRules(v =>
        {
            v.RuleFor(x => x.VariantId).NotEmpty();
            v.RuleFor(x => x.BuyPrice).GreaterThanOrEqualTo(0);
            v.RuleFor(x => x.VendorPrice).GreaterThanOrEqualTo(0);
        });
    }
}

internal sealed class SetVendorListingPricingCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver)
    : ICommandHandler<SetVendorListingPricingCommand, VendorListingPricingDto>
{
    public async Task<Result<VendorListingPricingDto>> Handle(SetVendorListingPricingCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.VendorId, out var vendorId) || !Guid.TryParse(request.ListingId, out var listingId))
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "vendors.listing.invalid_id",
                "Vendor and listing ids must be valid UUIDs.",
                ErrorCategory.Validation));
        }

        var listing = await repository.GetVendorProductListingByIdAsync(vendorId, listingId, cancellationToken);
        if (listing is null || listing.IsDeleted)
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "vendors.listing.not_found",
                "Vendor listing not found.",
                ErrorCategory.NotFound));
        }

        var product = await repository.GetProductByIdAsync(listing.ProductId, cancellationToken);
        if (product is null)
        {
            return Result.Failure<VendorListingPricingDto>(new Error(
                "products.not_found",
                "Catalog product not found.",
                ErrorCategory.NotFound));
        }

        var knownVariants = product.Variants.Select(v => v.Id).ToHashSet();
        var variantRows = new List<VendorListingVariantPriceOverride>();
        foreach (var variant in request.Variants ?? [])
        {
            if (!Guid.TryParse(variant.VariantId, out var variantId) || !knownVariants.Contains(variantId))
            {
                return Result.Failure<VendorListingPricingDto>(new Error(
                    "vendors.listing.unknown_variant",
                    "One or more packaging sizes do not belong to this product.",
                    ErrorCategory.Validation));
            }

            variantRows.Add(new VendorListingVariantPriceOverride
            {
                Id = Guid.CreateVersion7(),
                ProductVariantId = variantId,
                BuyPrice = variant.BuyPrice,
                VendorPrice = variant.VendorPrice,
            });
        }

        var row = new VendorListingPriceOverride
        {
            Id = Guid.CreateVersion7(),
            VendorProductListingId = listingId,
            IsCustomPricing = request.IsCustomPricing,
            DailyRent = request.DailyRent,
            SecurityDeposit = request.SecurityDeposit,
            BuyPrice = request.BuyPrice,
            VendorDailyRent = request.VendorDailyRent,
            VendorBuyPrice = request.VendorBuyPrice,
            CreatedBy = request.ActorAdminId,
            Variants = variantRows,
        };

        await repository.UpsertVendorListingPriceOverrideAsync(row, cancellationToken);

        var admins = await repository.GetAdminUsersAsync(cancellationToken);
        var actor = admins.FirstOrDefault(a => a.Id == request.ActorAdminId)
            ?? admins.FirstOrDefault(a => a.IsActive)
            ?? admins.FirstOrDefault();
        if (actor is not null)
        {
            var mode = request.IsCustomPricing ? "custom" : "catalog";
            await repository.AddAdminAuditLogAsync(new AdminAuditLog
            {
                Id = Guid.CreateVersion7(),
                AdminId = actor.Id,
                ActionType = "vendor.listing.price_set",
                EntityType = "vendor_product_listing",
                EntityId = listingId,
                NewValue = $"{{\"vendorId\":\"{vendorId}\",\"productId\":\"{product.Id}\",\"mode\":\"{mode}\"}}",
                Notes = $"Set {mode} pricing for \"{listing.ListingTitle}\" on vendor {vendorId}.",
            }, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);

        return await new GetVendorListingPricingQueryHandler(repository, fileUrlResolver)
            .Handle(new GetVendorListingPricingQuery(request.VendorId, request.ListingId), cancellationToken);
    }
}
