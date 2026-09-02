using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RecalculateProductRentalPricingCommand(
    string ProductId,
    bool ResetManualOverrides = false) : ICommand<ProductDto>;

public sealed class RecalculateProductRentalPricingCommandValidator
    : AbstractValidator<RecalculateProductRentalPricingCommand>
{
    public RecalculateProductRentalPricingCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
    }
}

internal sealed class RecalculateProductRentalPricingCommandHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver,
    IRentalPricingService rentalPricingService,
    Microsoft.Extensions.Options.IOptions<Domain.Options.RentalPricingOptions> rentalPricingOptions)
    : ICommandHandler<RecalculateProductRentalPricingCommand, ProductDto>
{
    public async Task<Result<ProductDto>> Handle(
        RecalculateProductRentalPricingCommand request,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.ProductId, out var productId))
        {
            return Result.Failure<ProductDto>(new Error(
                "products.invalid_product_id",
                "Product id must be a valid UUID.",
                ErrorCategory.Validation));
        }

        var applied = await rentalPricingService.RecalculateProductAsync(
            productId,
            request.ResetManualOverrides,
            cancellationToken);
        if (applied.IsFailure)
        {
            return Result.Failure<ProductDto>(applied.Errors);
        }

        var entity = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (entity is null)
        {
            return Result.Failure<ProductDto>(new Error(
                "products.product_not_found",
                "Product not found.",
                ErrorCategory.NotFound));
        }

        var liveIcons = RentalDurationIconLiveResolve.ToLookup(
            await repository.GetRentalDurationIconsAsync(activeOnly: false, cancellationToken));
        var durationMasters = await repository.GetRentalDurationMastersAsync(activeOnly: true, cancellationToken);

        return Result.Success(new ProductDto(
            entity.Id.ToString(),
            entity.CategoryId.ToString(),
            entity.ProductName,
            entity.BrandName,
            entity.ModelName,
            entity.ShortDescription,
            entity.LongDescription,
            entity.DailyRent,
            entity.WeeklyRent,
            entity.MonthlyRent,
            entity.SecurityDeposit,
            entity.BuyPrice,
            entity.VendorDailyRent,
            entity.VendorWeeklyRent,
            entity.VendorMonthlyRent,
            entity.VendorSecurityDeposit,
            entity.VendorBuyPrice,
            entity.GstPercent,
            entity.IsRentEnabled,
            entity.IsBuyEnabled,
            entity.IsActive,
            [],
            entity.Variants?.Select(v => new ProductVariantDto(
                v.Id.ToString(),
                v.ProductId.ToString(),
                v.Sku,
                v.SizeValue,
                v.SizeUnit,
                v.VendorPrice,
                v.BuyPrice,
                v.IsActive)).ToList() ?? [],
            entity.ChemicalProperty?.CasNumber,
            entity.ChemicalProperty?.ChemicalFormula,
            entity.ChemicalProperty?.PurityPercentage,
            entity.ChemicalProperty?.MolecularWeight,
            entity.ChemicalProperty?.BaseUnit,
            entity.ChemicalProperty?.SdsDocumentUrl,
            entity.ChemicalProperty?.CoaDocumentUrl,
            0,
            ProductRentalPricingPlanSync.ToProjectedDtos(
                entity,
                durationMasters,
                rentalPricingOptions.Value,
                fileUrlResolver,
                liveIcons),
            ProductCatalogDocuments.ToDtos(entity, fileUrlResolver)));
    }
}

public sealed record RecalculateAllProductRentalPricingCommand(bool ResetManualOverrides = false)
    : ICommand<RecalculateAllProductRentalPricingResultDto>;

public sealed record RecalculateAllProductRentalPricingResultDto(int ProductsProcessed);

internal sealed class RecalculateAllProductRentalPricingCommandHandler(
    IVendorOnboardingRepository repository,
    IRentalPricingService rentalPricingService)
    : ICommandHandler<RecalculateAllProductRentalPricingCommand, RecalculateAllProductRentalPricingResultDto>
{
    public async Task<Result<RecalculateAllProductRentalPricingResultDto>> Handle(
        RecalculateAllProductRentalPricingCommand request,
        CancellationToken cancellationToken)
    {
        var products = await repository.GetProductsAsync(null, cancellationToken);
        var count = products.Count(p => p.IsRentEnabled && p.DailyRent > 0m);
        await rentalPricingService.RecalculateAllAutomaticAsync(request.ResetManualOverrides, cancellationToken);
        return Result.Success(new RecalculateAllProductRentalPricingResultDto(count));
    }
}

public sealed record PreviewProductRentalPricingQuery(
    decimal DailyRent,
    decimal? BuyPrice,
    bool IsRentEnabled,
    List<CreateOrUpdateProductRentalPricingPlanDto>? ExistingPlans = null)
    : IQuery<PreviewProductRentalPricingDto>;

public sealed record PreviewProductRentalPricingDto(
    List<ProductRentalPricingPlanDto> Plans,
    int? EconomicMaximumDays,
    int EligiblePlanCount,
    int ConfiguredDurationCount,
    string? MostPopularDurationLabel);

internal sealed class PreviewProductRentalPricingQueryHandler(
    IVendorOnboardingRepository repository,
    IVendorFileUrlResolver fileUrlResolver,
    Microsoft.Extensions.Options.IOptions<Domain.Options.RentalPricingOptions> rentalPricingOptions)
    : IQueryHandler<PreviewProductRentalPricingQuery, PreviewProductRentalPricingDto>
{
    public async Task<Result<PreviewProductRentalPricingDto>> Handle(
        PreviewProductRentalPricingQuery request,
        CancellationToken cancellationToken)
    {
        if (!request.IsRentEnabled || request.DailyRent <= 0m)
        {
            return Result.Success(new PreviewProductRentalPricingDto([], null, 0, 0, null));
        }

        var masters = await repository.GetRentalDurationMastersAsync(activeOnly: true, cancellationToken);
        var liveIcons = RentalDurationIconLiveResolve.ToLookup(
            await repository.GetRentalDurationIconsAsync(activeOnly: false, cancellationToken));

        var existing = (request.ExistingPlans ?? [])
            .Select(dto =>
            {
                Guid.TryParse(dto.Id, out var planId);
                Guid.TryParse(dto.RentalDurationMasterId, out var masterId);
                Guid.TryParse(dto.RentalDurationIconId, out var iconId);
                var discountType = dto.ResetToAutomatic
                    ? RentalPricingPlanMath.None
                    : dto.DiscountType;
                return new ExistingRentalPlanInput(
                    planId == Guid.Empty ? null : planId,
                    masterId,
                    discountType,
                    dto.ResetToAutomatic ? 0m : dto.DiscountValue,
                    dto.IsRecommended,
                    iconId == Guid.Empty ? null : iconId,
                    dto.IconUrl,
                    dto.IconThumbnailUrl,
                    dto.ValueTier,
                    dto.IconName);
            })
            .Where(x => x.DurationMasterId != Guid.Empty)
            .ToList();

        var calculation = RentalPricingEngine.Calculate(
            request.DailyRent,
            request.BuyPrice,
            ProductRentalPricingApplicator.ToDurationInputs(masters),
            existing,
            rentalPricingOptions.Value);

        var plans = ProductRentalPricingPlanSync.ToDtosFromCalculation(
            Guid.Empty,
            calculation,
            existingPlans: null,
            fileUrlResolver,
            liveIcons);

        var popular = calculation.Plans.FirstOrDefault(p => p.IsRecommended);
        return Result.Success(new PreviewProductRentalPricingDto(
            plans,
            calculation.EconomicMaximumDays,
            calculation.EligibleCount,
            calculation.TotalDurationCount,
            popular is null ? null : popular.DurationLabel));
    }
}
