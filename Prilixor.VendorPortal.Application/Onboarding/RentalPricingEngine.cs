using Prilixor.VendorPortal.Domain.Options;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record RentalDurationPricingInput(
    Guid Id,
    string DurationLabel,
    int DurationDays,
    decimal BillingCycles,
    int SortOrder);

public sealed record ExistingRentalPlanInput(
    Guid? PlanId,
    Guid DurationMasterId,
    string DiscountType,
    decimal DiscountValue,
    bool IsRecommended,
    Guid? RentalDurationIconId = null,
    string? IconUrl = null,
    string? IconThumbnailUrl = null,
    string? ValueTier = null,
    string? IconName = null);

public sealed record ComputedRentalPlan(
    Guid DurationMasterId,
    Guid? ExistingPlanId,
    string DurationLabel,
    int DurationDays,
    decimal BillingCycles,
    decimal BasePrice,
    string PersistDiscountType,
    decimal DiscountValue,
    decimal DiscountAmount,
    decimal FinalPrice,
    bool IsEligible,
    bool IsRecommended,
    bool IsAutomatic,
    int SortOrder,
    Guid? RentalDurationIconId = null,
    string? IconUrl = null,
    string? IconThumbnailUrl = null,
    string? ValueTier = null,
    string? IconName = null);

public sealed record RentalPricingCalculation(
    int? EconomicMaximumDays,
    int EligibleCount,
    int TotalDurationCount,
    IReadOnlyList<ComputedRentalPlan> Plans);

/// <summary>
/// Pure rental pricing rules. Duration lists are supplied by the caller from the duration master.
/// </summary>
public static class RentalPricingEngine
{
    public const string DailyRateRequiredCode = "products.daily_rent_required";
    public const string DailyRateRequiredMessage =
        "Daily Rental Rate is required when rental is enabled.";

    public static bool IsDailyRateValidForRent(bool isRentEnabled, decimal dailyRate) =>
        !isRentEnabled || dailyRate > 0m;

    public static RentalPricingCalculation Calculate(
        decimal dailyRate,
        decimal? buyPrice,
        IEnumerable<RentalDurationPricingInput> durations,
        IEnumerable<ExistingRentalPlanInput>? existingPlans = null,
        RentalPricingOptions? options = null,
        bool resetManualOverrides = false)
    {
        options ??= new RentalPricingOptions();
        var existingByMaster = (existingPlans ?? [])
            .Where(p => p.DurationMasterId != Guid.Empty)
            .GroupBy(p => p.DurationMasterId)
            .ToDictionary(g => g.Key, g => g.First());

        var orderedDurations = (durations ?? [])
            .Where(d => d.DurationDays > 0 && d.Id != Guid.Empty)
            .GroupBy(d => d.Id)
            .Select(g => g.First())
            .OrderBy(d => d.DurationDays)
            .ThenBy(d => d.SortOrder)
            .ToList();

        if (dailyRate <= 0m || orderedDurations.Count == 0)
        {
            return new RentalPricingCalculation(null, 0, orderedDurations.Count, []);
        }

        var rate = dailyRate;
        var hasBuyPriceCap = buyPrice is > 0m;
        var theoreticalMaximumDays = CalculateEconomicMaximumDays(rate, buyPrice);

        var eligible = new List<RentalDurationPricingInput>();
        foreach (var duration in orderedDurations)
        {
            if (!hasBuyPriceCap || IsWithinBuyPrice(duration.DurationDays, rate, buyPrice!.Value))
            {
                eligible.Add(duration);
            }
        }

        var economicMaximumDays = hasBuyPriceCap && eligible.Count > 0
            ? eligible[^1].DurationDays
            : theoreticalMaximumDays;

        var autoDiscountByMaster = hasBuyPriceCap
            ? CalculateAutomaticDiscounts(eligible, options)
            : eligible.ToDictionary(d => d.Id, _ => 0m);
        var recommendedMasterId = SelectMostPopularDurationId(eligible, existingByMaster, resetManualOverrides);

        var plans = new List<ComputedRentalPlan>(orderedDurations.Count);
        foreach (var duration in orderedDurations)
        {
            existingByMaster.TryGetValue(duration.Id, out var existing);
            var isEligible = !hasBuyPriceCap || IsWithinBuyPrice(duration.DurationDays, rate, buyPrice!.Value);
            var basePrice = RoundMoney(rate * duration.DurationDays);
            var isManual = !resetManualOverrides
                && existing is not null
                && RentalPricingPlanMath.IsManualOverride(existing.DiscountType);

            string persistType;
            decimal discountValue;
            decimal finalPrice;
            if (isManual)
            {
                persistType = RentalPricingPlanMath.NormalizeDiscountType(existing!.DiscountType);
                discountValue = Math.Max(0m, existing.DiscountValue);
                finalPrice = RentalPricingPlanMath.ComputeSafeFinalPrice(basePrice, persistType, discountValue);
            }
            else
            {
                persistType = RentalPricingPlanMath.None;
                discountValue = isEligible && hasBuyPriceCap
                    ? autoDiscountByMaster.GetValueOrDefault(duration.Id)
                    : 0m;
                finalPrice = RentalPricingPlanMath.ComputeSafeFinalPrice(
                    basePrice,
                    RentalPricingPlanMath.Percentage,
                    discountValue);
            }

            var discountAmount = RoundMoney(Math.Max(0m, basePrice - finalPrice));
            var billingCycles = duration.BillingCycles > 0
                ? duration.BillingCycles
                : decimal.Round(duration.DurationDays / 28m, 2, MidpointRounding.AwayFromZero);

            plans.Add(new ComputedRentalPlan(
                duration.Id,
                existing?.PlanId,
                duration.DurationLabel,
                duration.DurationDays,
                billingCycles,
                basePrice,
                persistType,
                discountValue,
                discountAmount,
                finalPrice,
                isEligible,
                duration.Id == recommendedMasterId && isEligible,
                !isManual,
                duration.SortOrder,
                existing?.RentalDurationIconId,
                existing?.IconUrl,
                existing?.IconThumbnailUrl,
                existing?.ValueTier,
                existing?.IconName));
        }

        return new RentalPricingCalculation(
            economicMaximumDays,
            eligible.Count,
            orderedDurations.Count,
            plans);
    }

    /// <summary>
    /// Floor(buyPrice ÷ dailyRate). Null when buy price cannot be used as an economic cap.
    /// Eligible plans are those whose base amount (days × daily rate) does not exceed buy price.
    /// </summary>
    public static int? CalculateEconomicMaximumDays(
        decimal dailyRate,
        decimal? buyPrice,
        RentalPricingOptions? options = null)
    {
        if (dailyRate <= 0m || buyPrice is not > 0m)
        {
            return null;
        }

        _ = options;
        return (int)decimal.Floor(buyPrice.Value / dailyRate);
    }

    public static bool IsWithinBuyPrice(int durationDays, decimal dailyRate, decimal buyPrice) =>
        durationDays > 0 && dailyRate > 0m && buyPrice > 0m && (dailyRate * durationDays) <= buyPrice;

    /// <summary>
    /// Isolated most-popular rule: keep a manual plan's recommendation when still eligible; otherwise the middle eligible duration.
    /// </summary>
    public static Guid? SelectMostPopularDurationId(
        IReadOnlyList<RentalDurationPricingInput> eligibleDurations,
        IReadOnlyDictionary<Guid, ExistingRentalPlanInput>? existingByMaster = null,
        bool resetManualOverrides = false)
    {
        if (eligibleDurations.Count == 0)
        {
            return null;
        }

        if (!resetManualOverrides && existingByMaster is not null)
        {
            var manualRecommended = eligibleDurations
                .Select(d => existingByMaster.GetValueOrDefault(d.Id))
                .FirstOrDefault(p => p is not null
                    && p.IsRecommended
                    && RentalPricingPlanMath.IsManualOverride(p.DiscountType));
            if (manualRecommended is not null)
            {
                return manualRecommended.DurationMasterId;
            }
        }

        return eligibleDurations[MiddleIndex(eligibleDurations.Count)].Id;
    }

    public static int MiddleIndex(int eligibleCount)
    {
        if (eligibleCount <= 0)
        {
            return 0;
        }

        return (eligibleCount - 1) / 2;
    }

    /// <summary>
    /// Nearest whole-integer percent, clamped to 0…MaximumDiscountPercent.
    /// </summary>
    public static decimal RoundAutomaticDiscountPercent(
        decimal rawPercent,
        RentalPricingOptions? options = null)
    {
        options ??= new RentalPricingOptions();
        var max = Math.Max(0m, options.MaximumDiscountPercent);
        var raw = Math.Clamp(rawPercent, 0m, max);
        var rounded = decimal.Round(raw, 0, MidpointRounding.AwayFromZero);
        if (rounded > max)
        {
            rounded = max;
        }

        return rounded < 0m ? 0m : rounded;
    }

    private static Dictionary<Guid, decimal> CalculateAutomaticDiscounts(
        IReadOnlyList<RentalDurationPricingInput> eligible,
        RentalPricingOptions options)
    {
        var result = new Dictionary<Guid, decimal>();
        if (eligible.Count == 0)
        {
            return result;
        }

        var minAnchor = options.MinimumPlanDays > 0 ? options.MinimumPlanDays : 7;
        var maxDiscount = Math.Max(0m, options.MaximumDiscountPercent);
        var maxDiscountInteger = RoundAutomaticDiscountPercent(maxDiscount, options);
        var exponent = options.DiscountCurveExponent <= 0 ? 1d : options.DiscountCurveExponent;
        var maxDays = eligible[^1].DurationDays;

        foreach (var duration in eligible)
        {
            if (duration.DurationDays <= minAnchor)
            {
                result[duration.Id] = 0m;
                continue;
            }

            if (maxDays > minAnchor && duration.DurationDays == maxDays)
            {
                result[duration.Id] = maxDiscountInteger;
                continue;
            }

            var span = maxDays - minAnchor;
            if (span <= 0)
            {
                result[duration.Id] = 0m;
                continue;
            }

            var progress = Math.Clamp((double)(duration.DurationDays - minAnchor) / span, 0d, 1d);
            var raw = (decimal)((double)maxDiscount * Math.Pow(progress, exponent));
            var rounded = RoundAutomaticDiscountPercent(raw, options);
            result[duration.Id] = rounded < 1m ? 1m : rounded;
        }

        decimal previous = 0m;
        foreach (var duration in eligible)
        {
            var current = result[duration.Id];
            if (current < previous)
            {
                current = previous;
            }

            result[duration.Id] = current;
            previous = current;
        }

        return result;
    }

    public static decimal RoundMoney(decimal value) =>
        decimal.Round(Math.Max(0m, value), 2, MidpointRounding.AwayFromZero);
}
