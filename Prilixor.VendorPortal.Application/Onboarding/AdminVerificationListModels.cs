namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class AdminVerificationListQuerySpec
{
    public string? Search { get; init; }
    public string? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed record AdminVerificationListRow(
    string Id,
    string Email,
    string AccountStatus,
    string RegistrationStage,
    bool IsEmailVerified,
    string? BusinessName);

public sealed class AdminVerificationListResult
{
    public List<AdminVerificationListRow> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}
