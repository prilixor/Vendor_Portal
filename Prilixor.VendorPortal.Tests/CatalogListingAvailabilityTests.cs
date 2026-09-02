using Prilixor.VendorPortal.Application.Onboarding;

namespace Prilixor.VendorPortal.Tests;

public class CatalogListingAvailabilityTests
{
    [Fact]
    public void Chemical_shop_badge_uses_packaging_stock_not_listing_zero()
    {
        var available = CatalogListingAvailability.ResolveAvailableQuantity(
            isChemical: true,
            listingLevelAvailable: 0,
            variantAvailableSum: 50);

        Assert.Equal(50, available);
        Assert.Equal("available", CatalogListingAvailability.ToStatus(available));
    }

    [Fact]
    public void Chemical_with_zero_packaging_stock_is_out_of_stock()
    {
        var available = CatalogListingAvailability.ResolveAvailableQuantity(
            isChemical: true,
            listingLevelAvailable: 12,
            variantAvailableSum: 0);

        Assert.Equal(0, available);
        Assert.Equal("out_of_stock", CatalogListingAvailability.ToStatus(available));
    }

    [Fact]
    public void Equipment_ignores_variant_sum_and_uses_listing_inventory()
    {
        var available = CatalogListingAvailability.ResolveAvailableQuantity(
            isChemical: false,
            listingLevelAvailable: 8,
            variantAvailableSum: 50);

        Assert.Equal(8, available);
        Assert.Equal("available", CatalogListingAvailability.ToStatus(available));
    }

    [Fact]
    public void Chemical_without_variant_rows_falls_back_to_listing_inventory()
    {
        var available = CatalogListingAvailability.ResolveAvailableQuantity(
            isChemical: true,
            listingLevelAvailable: 4,
            variantAvailableSum: null);

        Assert.Equal(4, available);
        Assert.Equal("available", CatalogListingAvailability.ToStatus(available));
    }

    [Fact]
    public void Low_stock_threshold_is_three_or_fewer()
    {
        Assert.Equal("low_stock", CatalogListingAvailability.ToStatus(3));
        Assert.Equal("low_stock", CatalogListingAvailability.ToStatus(1));
        Assert.Equal("available", CatalogListingAvailability.ToStatus(4));
    }

    [Fact]
    public void Marketplace_equipment_sums_vendor_stock()
    {
        var total = CatalogListingAvailability.SumAvailable([3, 10, 0, -1]);
        Assert.Equal(13, total);
    }

    [Fact]
    public void Marketplace_chemicals_sum_per_packaging_size()
    {
        var oneKg = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var fiveHundredG = Guid.Parse("22222222-2222-2222-2222-222222222222");

        var bySize = CatalogListingAvailability.SumByVariantId(
        [
            (oneKg, 3),
            (oneKg, 10),
            (fiveHundredG, 20),
            (fiveHundredG, 0),
        ]);

        Assert.Equal(13, bySize[oneKg]);
        Assert.Equal(20, bySize[fiveHundredG]);
    }
}
