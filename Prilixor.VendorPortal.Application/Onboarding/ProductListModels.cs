namespace Prilixor.VendorPortal.Application.Onboarding;

public sealed class ProductListQuerySpec
{
    public Guid? CategoryId { get; init; }
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public IReadOnlyCollection<Guid>? ProductIds { get; init; }
    public bool? IsChemical { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
}

public sealed class ProductListResult
{
    public required List<ProductListRow> Items { get; init; }
    public int TotalCount { get; init; }
}

public sealed class ProductListRow
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public decimal DailyRent { get; set; }
    public decimal WeeklyRent { get; set; }
    public decimal MonthlyRent { get; set; }
    public decimal SecurityDeposit { get; set; }
    public decimal? BuyPrice { get; set; }
    public decimal VendorDailyRent { get; set; }
    public decimal VendorWeeklyRent { get; set; }
    public decimal VendorMonthlyRent { get; set; }
    public decimal VendorSecurityDeposit { get; set; }
    public decimal? VendorBuyPrice { get; set; }
    public decimal GstPercent { get; set; }
    public bool IsRentEnabled { get; set; }
    public bool IsBuyEnabled { get; set; }
    public bool IsActive { get; set; }
    public string? CasNumber { get; set; }
    public string? ChemicalFormula { get; set; }
    public decimal? PurityPercentage { get; set; }
    public decimal? MolecularWeight { get; set; }
    public string? BaseUnit { get; set; }
    public Guid? PrimaryImageId { get; set; }
    public string? PrimaryImageUrl { get; set; }
    public string? PrimaryThumbnailUrl { get; set; }
    public int PrimaryImageDisplayOrder { get; set; }
    public bool PrimaryImageIsPrimary { get; set; }
    public List<ProductListVariantRow> Variants { get; set; } = [];
}

public sealed class ProductListVariantRow
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string Sku { get; set; } = string.Empty;
    public decimal SizeValue { get; set; }
    public string SizeUnit { get; set; } = string.Empty;
    public decimal VendorPrice { get; set; }
    public decimal BuyPrice { get; set; }
    public bool IsActive { get; set; }
}
