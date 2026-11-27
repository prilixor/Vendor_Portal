namespace Prilixor.VendorPortal.Application.Customers;

public sealed class AdminOrderListQuerySpec
{
    public string? Search { get; init; }
    public string? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
    /// <summary>Inclusive lower bound on <c>CreatedOnUtc</c>. Null leaves the start open.</summary>
    public DateTime? FromUtc { get; init; }
    /// <summary>
    /// Inclusive upper bound on the placed minute. The orders screen sends minute precision;
    /// the query includes every order in that minute.
    /// </summary>
    public DateTime? ToUtc { get; init; }
}

public sealed record AdminOrderListStats(
    int TotalCount,
    decimal Revenue,
    int Active,
    int Returned,
    int Failed);

public sealed record AdminOrderListRow(
    Guid OrderId,
    string OrderNumber,
    Guid CustomerId,
    string CustomerName,
    string CustomerEmail,
    string VendorName,
    string ListingTitle,
    string Status,
    string OrderType,
    int Quantity,
    int RentalDays,
    decimal TotalAmount,
    decimal DepositAmount,
    decimal VendorSubtotalAmount,
    DateTimeOffset CreatedOnUtc,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? PrimaryImageUrl,
    bool IsExtended,
    OrderCancelInfoDto? CancelInfo = null);

public sealed class AdminOrderListResult
{
    public List<AdminOrderListRow> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public AdminOrderListStats Stats { get; init; } = new(0, 0, 0, 0, 0);
    public Dictionary<string, int> StatusCounts { get; init; } = new();
}
