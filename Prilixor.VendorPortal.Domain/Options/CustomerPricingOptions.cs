namespace Prilixor.VendorPortal.Domain.Options;

public sealed class CustomerPricingOptions
{
    public const string SectionName = "CustomerPricing";

    public decimal BaseServiceFeePerLine { get; set; } = 12m;
    public decimal ExpressDeliveryFeePerLine { get; set; } = 19m;
    public decimal FreeDistanceKm { get; set; } = 30m;
    public decimal DistanceFeePerKm { get; set; } = 10m;
    public decimal GstPercent { get; set; } = 18m;
    public decimal BuyPriceMultiplierFromDailyRent { get; set; } = 30m;
    public decimal DispatchOfferTtlMinutes { get; set; } = 2m;
    public int MaxDispatchVendorsPerLine { get; set; } = 3;

    public decimal BuyoutRentDeductionPercentage { get; set; } = 50m;
    public decimal ExtensionServiceFee { get; set; } = 5m;

    /// <summary>
    /// When true, at least one active vendor service area must cover the customer location.
    /// </summary>
    public bool EnforceVendorServiceRadius { get; set; } = true;

    /// <summary>
    /// Fallback service radius when vendor has no active service-area rows.
    /// </summary>
    public decimal DefaultServiceRadiusKm { get; set; } = 30m;
}
