using Prilixor.VendorPortal.Application.Abstractions;

namespace Prilixor.VendorPortal.Application.Customers;

/// <summary>
/// Customer shop shows marketplace totals (Vendor A1 3 + Vendor A2 10 = 13),
/// not only the representative listing the browse card linked to.
/// Chemicals stay per packaging size (same ProductVariantId).
/// </summary>
public static class CustomerMarketplaceStock
{
    public static int ResolveAvailable(VendorProductListingAggregate agg, Guid? productVariantId)
    {
        if (productVariantId is Guid variantId)
        {
            var market = agg.MarketplaceVariantInventory
                .FirstOrDefault(vi => vi.ProductVariantId == variantId);
            if (market is not null)
                return Math.Max(0, market.AvailableQuantity);

            return Math.Max(0, agg.VariantInventory
                .FirstOrDefault(vi => vi.ProductVariantId == variantId)
                ?.AvailableQuantity ?? 0);
        }

        return Math.Max(0, agg.ProductTotalAvailableQuantity);
    }

    public static string SizeOrSkuLabel(VendorProductListingAggregate agg, Guid? productVariantId)
    {
        if (productVariantId is not Guid variantId)
            return agg.ListingTitle;

        var variant = agg.Variants.FirstOrDefault(v => v.Id == variantId.ToString());
        if (variant is null)
            return "Selected size";

        var size = $"{variant.SizeValue} {variant.SizeUnit}".Trim();
        return string.IsNullOrWhiteSpace(size) ? (variant.Sku ?? "Selected size") : size;
    }
}
