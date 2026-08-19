using Prilixor.Shared.Abstractions.DB;

namespace Prilixor.VendorPortal.Domain.Vendors;

public class Product : AuditableEntity<Guid>, ISoftDelete
{
    public Guid CategoryId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public string? ModelName { get; set; }
    public string? ShortDescription { get; set; }
    public string? LongDescription { get; set; }
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
    public decimal GstPercent { get; set; } = 18m;
    public bool IsRentEnabled { get; set; } = true;
    public bool IsBuyEnabled { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ProductCategory Category { get; set; } = null!;
    public ICollection<ProductImage> ProductImages { get; set; } = [];
    public ICollection<ProductDocument> ProductDocuments { get; set; } = [];
    public ICollection<VendorProductListing> VendorProductListings { get; set; } = [];
    public ChemicalProperty? ChemicalProperty { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = [];
    public ICollection<ProductRentalPricingPlan> RentalPricingPlans { get; set; } = [];
}
