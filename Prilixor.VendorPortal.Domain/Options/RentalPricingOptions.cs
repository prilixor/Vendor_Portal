namespace Prilixor.VendorPortal.Domain.Options;

/// <summary>
/// Configurable inputs for automatic rental-duration pricing.
/// Duration days themselves always come from the rental-duration master, not from this section.
/// </summary>
public sealed class RentalPricingOptions
{
    public const string SectionName = "RentalPricing";

    /// <summary>Share of customer buy price used to cap economically sensible rental length.</summary>
    public decimal TargetRecoveryPercentage { get; set; } = 90m;

    /// <summary>Highest automatic percentage discount. Manual overrides may still use other values, subject to safety caps.</summary>
    public decimal MaximumDiscountPercent { get; set; } = 20m;

    /// <summary>Automatic discounts are rounded down to this step (e.g. 5 → 0/5/10/15/20).</summary>
    public decimal DiscountStepPercent { get; set; } = 5m;

    /// <summary>Progress curve exponent. Values &gt; 1 grow discounts slowly at short durations.</summary>
    public double DiscountCurveExponent { get; set; } = 1.5;
}
