namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>In-memory custom prices for one vendor listing. Absent or disabled means catalog prices.</summary>
public sealed class VendorListingPriceSnapshot
{
    public bool IsCustomPricing { get; init; }
    public decimal? DailyRent { get; init; }
    public decimal? SecurityDeposit { get; init; }
    public decimal? BuyPrice { get; init; }
    public decimal? VendorDailyRent { get; init; }
    public decimal? VendorBuyPrice { get; init; }
    public Dictionary<Guid, VendorListingVariantPriceSnapshot> Variants { get; init; } = [];

    public static decimal Rate(bool custom, decimal? overrideValue, decimal catalog) =>
        custom && overrideValue.HasValue ? overrideValue.Value : catalog;

    public static decimal? Money(bool custom, decimal? overrideValue, decimal? catalog) =>
        custom && overrideValue.HasValue ? overrideValue : catalog;

    public static (decimal Weekly, decimal Monthly) ScalePeriodRates(decimal catalogDaily, decimal catalogWeekly, decimal catalogMonthly, decimal resolvedDaily)
    {
        if (catalogDaily > 0m && resolvedDaily != catalogDaily)
        {
            var ratio = resolvedDaily / catalogDaily;
            return (
                decimal.Round(catalogWeekly * ratio, 2, MidpointRounding.AwayFromZero),
                decimal.Round(catalogMonthly * ratio, 2, MidpointRounding.AwayFromZero));
        }

        if (catalogDaily <= 0m && resolvedDaily > 0m)
        {
            return (decimal.Round(resolvedDaily * 7m, 2, MidpointRounding.AwayFromZero), decimal.Round(resolvedDaily * 30m, 2, MidpointRounding.AwayFromZero));
        }

        return (catalogWeekly, catalogMonthly);
    }
}

public readonly record struct VendorListingVariantPriceSnapshot(decimal BuyPrice, decimal VendorPrice);
