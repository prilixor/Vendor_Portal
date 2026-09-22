namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class AdminVendorListQuerySpec
{
    public string? Search { get; init; }
    public string? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 9;
}

public sealed record AdminVendorListRow(
    string Id,
    string Email,
    string AccountStatus,
    string? BusinessName,
    string? OwnerName,
    string? City,
    int DocumentCount,
    int ListingCount);

public sealed class AdminVendorListResult
{
    public List<AdminVendorListRow> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
