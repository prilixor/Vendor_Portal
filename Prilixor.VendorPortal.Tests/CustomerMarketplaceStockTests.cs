using Prilixor.VendorPortal.Application.Abstractions;
using Prilixor.VendorPortal.Application.Customers;
using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.Tests;

public class CustomerMarketplaceStockTests
{
    [Fact]
    public void Equipment_uses_product_total_across_vendors()
    {
        var agg = new VendorProductListingAggregate
        {
            ProductTotalAvailableQuantity = 13,
            InventoryAvailable = 3,
            ListingTitle = "Bedside Commode",
        };

        Assert.Equal(13, CustomerMarketplaceStock.ResolveAvailable(agg, null));
    }

    [Fact]
    public void Chemical_uses_marketplace_stock_for_selected_size()
    {
        var oneKg = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var fiveHundredG = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var agg = new VendorProductListingAggregate
        {
            ProductTotalAvailableQuantity = 33,
            InventoryAvailable = 10,
            ListingTitle = "QA Potassium Chloride AR",
            Variants =
            [
                new ProductVariantDto(
                    oneKg.ToString(),
                    Guid.NewGuid().ToString(),
                    "KCL-1KG",
                    1m,
                    "Kg",
                    0m,
                    240m,
                    true),
            ],
            VariantInventory = [new VariantInventoryItem(oneKg, 10)],
            MarketplaceVariantInventory =
            [
                new VariantInventoryItem(oneKg, 13),
                new VariantInventoryItem(fiveHundredG, 20),
            ],
        };

        Assert.Equal(13, CustomerMarketplaceStock.ResolveAvailable(agg, oneKg));
        Assert.Equal(20, CustomerMarketplaceStock.ResolveAvailable(agg, fiveHundredG));
        Assert.Equal("1 Kg", CustomerMarketplaceStock.SizeOrSkuLabel(agg, oneKg));
    }
}
