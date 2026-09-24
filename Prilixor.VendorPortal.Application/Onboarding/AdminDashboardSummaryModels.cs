namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed record AdminDashboardPendingVendorRow(
    string Id,
    string Email,
    string RegistrationStage,
    bool IsEmailVerified);

public sealed record AdminDashboardAuditLogRow(
    string Id,
    string ActionType,
    string? AdminName,
    string? AdminEmail,
    string AdminId,
    string EntityType);

public sealed class AdminDashboardVendorSnapshot
{
    public int TotalVendorCount { get; init; }
    public int PendingVendorCount { get; init; }
    public int ActiveVendorCount { get; init; }
    public List<AdminDashboardPendingVendorRow> PendingVendors { get; init; } = [];
}

public sealed class AdminDashboardAuditSnapshot
{
    public int AuditEventCountLast7Days { get; init; }
    public List<AdminDashboardAuditLogRow> RecentAuditLogs { get; init; } = [];
}

public sealed class AdminDashboardSummaryDto
{
    public int TotalVendorCount { get; init; }
    public int PendingVendorCount { get; init; }
    public int ActiveVendorCount { get; init; }
    public int AuditEventCountLast7Days { get; init; }
    public List<AdminDashboardPendingVendorRow> PendingVendors { get; init; } = [];
    public List<AdminDashboardAuditLogRow> RecentAuditLogs { get; init; } = [];
}
