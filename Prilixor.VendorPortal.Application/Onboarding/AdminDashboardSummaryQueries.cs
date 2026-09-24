using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record GetAdminDashboardSummaryQuery : IQuery<AdminDashboardSummaryDto>;

internal sealed class GetAdminDashboardSummaryQueryHandler(
    IVendorOnboardingRepository vendors,
    ICustomerRepository customers)
    : IQueryHandler<GetAdminDashboardSummaryQuery, AdminDashboardSummaryDto>
{
    public async Task<Result<AdminDashboardSummaryDto>> Handle(
        GetAdminDashboardSummaryQuery request,
        CancellationToken cancellationToken)
    {
        var sinceUtc = DateTime.UtcNow.AddDays(-7);

        // Vendor repo shares DbContext instances — do not run its queries in parallel.
        var vendorSnap = await vendors.GetAdminDashboardVendorSnapshotAsync(5, cancellationToken);
        var auditSnap = await vendors.GetAdminDashboardAuditSnapshotAsync(sinceUtc, 5, cancellationToken);
        var dueReturnsCount = await customers.CountAdminExpirationGroupsAsync(7, cancellationToken);

        return Result.Success(new AdminDashboardSummaryDto
        {
            TotalVendorCount = vendorSnap.TotalVendorCount,
            PendingVendorCount = vendorSnap.PendingVendorCount,
            ActiveVendorCount = vendorSnap.ActiveVendorCount,
            AuditEventCountLast7Days = auditSnap.AuditEventCountLast7Days,
            DueReturnsCount = dueReturnsCount,
            PendingVendors = vendorSnap.PendingVendors,
            RecentAuditLogs = auditSnap.RecentAuditLogs,
        });
    }
}
