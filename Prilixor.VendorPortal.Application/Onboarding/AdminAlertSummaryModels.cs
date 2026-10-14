namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class AdminAlertSummaryDto
{
    public int CriticalOrderCount { get; init; }
    public int PendingVendorCount { get; init; }
    public int ListingPricingAlertCount { get; init; }
}
