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
        var criticalOrders = await customers.CountCriticalAdminOrdersAsync(cancellationToken);
        var refunds = await customers.CountPendingDepositRefundsAsync(cancellationToken);
        var cancellationRefunds = await customers.CountPendingCancellationRefundsAsync(cancellationToken);
        var pendingVendors = await vendors.CountPendingVendorsAsync(cancellationToken);
        var listingAlerts = await vendors.CountListingPricingAlertsAsync(cancellationToken);

        return Result.Success(new AdminAlertSummaryDto
        {
            CriticalOrderCount = criticalOrders,
            PendingDepositRefundCount = refunds,
            PendingCancellationRefundCount = cancellationRefunds,
            PendingVendorCount = pendingVendors,
            ListingPricingAlertCount = listingAlerts,
        });
    }
}
