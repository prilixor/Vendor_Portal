using FluentValidation;
using Prilixor.Shared.Abstractions.CQRS;
using Prilixor.Shared.Models;
using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

public sealed class CustomerCatalogListingSummaryQuerySpec
{
    public string? Search { get; init; }
    public string? Category { get; init; }
    public bool? IsChemical { get; init; }
    public string? Stock { get; init; }
    public bool FavoritesOnly { get; init; }
    public Guid? CustomerId { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 8;
}

public sealed class CustomerCatalogListingSummariesResult
{
    public List<CustomerCatalogListingDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    /// <summary>Rows after tab/search/stock/favorites, before the category chip.</summary>
    public int AllCount { get; init; }
    public Dictionary<string, int> CategoryCounts { get; init; } = [];
}

public sealed record GetCustomerCatalogListingSummariesQuery(
    string? Search,
    string? Category,
    bool? IsChemical,
    string? Stock,
    bool FavoritesOnly,
    Guid? CustomerId,
    int Page = 1,
    int PageSize = 8) : IQuery<CustomerCatalogListingSummariesResult>;

public sealed class GetCustomerCatalogListingSummariesQueryValidator
    : AbstractValidator<GetCustomerCatalogListingSummariesQuery>
{
    public GetCustomerCatalogListingSummariesQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 50);
        RuleFor(x => x.Stock)
            .Must(s => string.IsNullOrWhiteSpace(s) || s is "all" or "low_stock" or "out_of_stock")
            .WithMessage("Stock must be all, low_stock, or out_of_stock.");
    }
}

internal sealed class GetCustomerCatalogListingSummariesQueryHandler(ICustomerRepository customers)
    : IQueryHandler<GetCustomerCatalogListingSummariesQuery, CustomerCatalogListingSummariesResult>
{
    public async Task<Result<CustomerCatalogListingSummariesResult>> Handle(
        GetCustomerCatalogListingSummariesQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);

        var result = await customers.SearchPublicCatalogListingSummariesAsync(
            new CustomerCatalogListingSummaryQuerySpec
            {
                Search = request.Search,
                Category = request.Category,
                IsChemical = request.IsChemical,
                Stock = request.Stock,
                FavoritesOnly = request.FavoritesOnly,
                CustomerId = request.CustomerId,
                Page = page,
                PageSize = pageSize,
            },
            cancellationToken);

        return Result.Success(result);
    }
}
