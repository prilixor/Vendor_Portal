using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminAlertSummaryQuery : IQuery<AdminAlertSummaryDto>;

internal sealed class GetAdminAlertSummaryQueryHandler(
    ICustomerRepository customers,
    IVendorOnboardingRepository vendors)
    : IQueryHandler<GetAdminAlertSummaryQuery, AdminAlertSummaryDto>
{
    public async Task<Result<AdminAlertSummaryDto>> Handle(
        GetAdminAlertSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var criticalOrders = customers.CountCriticalAdminOrdersAsync(cancellationToken);
        var pendingVendors = vendors.CountPendingVendorsAsync(cancellationToken);
        var listingAlerts = vendors.CountListingPricingAlertsAsync(cancellationToken);
        await Task.WhenAll(criticalOrders, pendingVendors, listingAlerts);

        return Result.Success(new AdminAlertSummaryDto
        {
            CriticalOrderCount = criticalOrders.Result,
            PendingVendorCount = pendingVendors.Result,
            ListingPricingAlertCount = listingAlerts.Result,
        });
    }
}
