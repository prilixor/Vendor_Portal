using Microsoft.Extensions.Options;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Domain.Options;
using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

public interface IRentalPricingService
{
    /// <summary>
    /// Recalculates automatic plans for one product using the supplied duration masters.
    /// Does not save. Skips generation when rent is disabled.
    /// </summary>
    Result ApplyAutomaticPricing(
        Product product,
        IReadOnlyList<RentalDurationMaster> masters,
        bool resetManualOverrides = false);

    Task<Result> RecalculateProductAsync(
        Guid productId,
        bool resetManualOverrides,
        CancellationToken cancellationToken);

    Task RecalculateAllAutomaticAsync(
        bool resetManualOverrides,
        CancellationToken cancellationToken);
}

internal sealed class RentalPricingService(
    IVendorOnboardingRepository repository,
    IOptions<RentalPricingOptions> options) : IRentalPricingService
{
    private readonly RentalPricingOptions _options = options.Value ?? new RentalPricingOptions();

    public Result ApplyAutomaticPricing(
        Product product,
        IReadOnlyList<RentalDurationMaster> masters,
        bool resetManualOverrides = false)
    {
        ArgumentNullException.ThrowIfNull(product);

        if (!product.IsRentEnabled)
        {
            return Result.Success();
        }

        if (product.DailyRent <= 0m)
        {
            return Result.Failure(new Error(
                RentalPricingEngine.DailyRateRequiredCode,
                RentalPricingEngine.DailyRateRequiredMessage,
                ErrorCategory.Validation));
        }

        var calculation = RentalPricingEngine.Calculate(
            product.DailyRent,
            product.BuyPrice,
            ProductRentalPricingApplicator.ToDurationInputs(masters),
            ProductRentalPricingApplicator.ToExistingInputs(product.RentalPricingPlans),
            _options,
            resetManualOverrides);

        ProductRentalPricingApplicator.Apply(product, calculation);
        return Result.Success();
    }

    public async Task<Result> RecalculateProductAsync(
        Guid productId,
        bool resetManualOverrides,
        CancellationToken cancellationToken)
    {
        var product = await repository.GetProductByIdAsync(productId, cancellationToken);
        if (product is null)
        {
            return Result.Failure(new Error(
                "products.product_not_found",
                "Product not found.",
                ErrorCategory.NotFound));
        }

        var masters = await repository.GetRentalDurationMastersAsync(activeOnly: true, cancellationToken);
        var applied = ApplyAutomaticPricing(product, masters, resetManualOverrides);
        if (applied.IsFailure)
        {
            return applied;
        }

        await repository.UpdateProductAsync(product, cancellationToken);
        await repository.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }

    public async Task RecalculateAllAutomaticAsync(
        bool resetManualOverrides,
        CancellationToken cancellationToken)
    {
        var masters = await repository.GetRentalDurationMastersAsync(activeOnly: true, cancellationToken);
        var products = await repository.GetProductsAsync(null, cancellationToken);

        foreach (var product in products)
        {
            if (!product.IsRentEnabled || product.DailyRent <= 0m)
            {
                continue;
            }

            var applied = ApplyAutomaticPricing(product, masters, resetManualOverrides);
            if (applied.IsFailure)
            {
                continue;
            }

            await repository.UpdateProductAsync(product, cancellationToken);
        }

        await repository.SaveChangesAsync(cancellationToken);
    }
}
