namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>
/// Configurable inputs for automatic rental-duration pricing.
/// Duration days themselves always come from the rental-duration master, not from this section.
/// </summary>
public sealed class RentalPricingOptions
{
    public const string SectionName = "RentalPricing";

    /// <summary>Kept for config compatibility. Automatic eligibility uses full buy price (plan days × daily rate ≤ buy price).</summary>
    public decimal TargetRecoveryPercentage { get; set; } = 100m;

    /// <summary>Highest automatic percentage discount. Manual overrides may still use other values, subject to safety caps.</summary>
    public decimal MaximumDiscountPercent { get; set; } = 20m;

    /// <summary>Kept for config compatibility. Automatic discounts round to the nearest integer percent, not stepped buckets.</summary>
    public decimal DiscountStepPercent { get; set; } = 1m;

    /// <summary>Progress curve exponent. Values &gt; 1 grow discounts slowly at short durations.</summary>
    public double DiscountCurveExponent { get; set; } = 1.5;

    /// <summary>Plan at or below this length always receives 0% automatic discount. Discount starts after this many days.</summary>
    public int MinimumPlanDays { get; set; } = 7;
}
