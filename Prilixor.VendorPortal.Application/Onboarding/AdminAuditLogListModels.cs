namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class AdminAuditLogListQuerySpec
{
    public string? Search { get; init; }
    public string? AdminUserId { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed record AdminAuditLogActorOption(string Id, string Label);

public sealed record AdminAuditLogListRow(
    string Id,
    string ActionType,
    string EntityType,
    string AdminId,
    string? AdminName,
    string? AdminEmail,
    string? OldValue,
    string? NewValue);

public sealed class AdminAuditLogListResult
{
    public List<AdminAuditLogListRow> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public List<AdminAuditLogActorOption> Actors { get; init; } = [];
}
