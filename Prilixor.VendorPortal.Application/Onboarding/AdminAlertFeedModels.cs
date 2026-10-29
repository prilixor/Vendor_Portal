namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class AdminAlertFeedQuerySpec
{
    public string Tab { get; init; } = "all";
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 15;
}

public sealed record AdminAlertPendingVendorRow(
    string Id,
    string Email,
    string AccountStatus,
    string? BusinessName,
    string? OwnerName,
    DateTime CreatedOnUtc);

public sealed class AdminAlertAuditLogPage
{
    public List<AdminAuditLogDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
}

public sealed class AdminAlertFeedCounts
{
    public int All { get; init; }
    public int Orders { get; init; }
    public int Vendors { get; init; }
    public int Listings { get; init; }
    public int Logs { get; init; }
}

public sealed class AdminAlertFeedItem
{
    public string Id { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTimeOffset Timestamp { get; init; }
    public string Link { get; init; } = string.Empty;
    public string? OrderId { get; init; }
    public string? OrderNumber { get; init; }
    public string? ListingTitle { get; init; }
    public string? CustomerName { get; init; }
    public string? VendorName { get; init; }
    public decimal? Amount { get; init; }
    public string? VendorId { get; init; }
    public string? Company { get; init; }
    public string? OwnerName { get; init; }
    public string? Email { get; init; }
    public string? Kind { get; init; }
    public string? Notes { get; init; }
    public string? ActionType { get; init; }
    public string? EntityType { get; init; }
    public string? AdminId { get; init; }
    public string? AdminName { get; init; }
    public string? AdminEmail { get; init; }
    public string? OldValue { get; init; }
    public string? NewValue { get; init; }
}

public sealed class AdminAlertFeedResult
{
    public List<AdminAlertFeedItem> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public AdminAlertFeedCounts Counts { get; init; } = new();
}
