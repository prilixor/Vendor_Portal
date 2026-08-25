namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Shop / admin badges must follow chemical packaging-size stock.
/// Listing-level inventory is often 0 even when SKU rows have quantity
/// (vendor Inventory and product detail already read those SKU rows).
/// </summary>
public static class CatalogListingAvailability
{
    public static int ResolveAvailableQuantity(
        bool isChemical,
        int listingLevelAvailable,
        int? variantAvailableSum)
    {
        if (isChemical && variantAvailableSum.HasValue)
        {
            return Math.Max(0, variantAvailableSum.Value);
        }

        return Math.Max(0, listingLevelAvailable);
    }

    public static string ToStatus(int availableQuantity) =>
        availableQuantity <= 0
            ? "out_of_stock"
            : availableQuantity <= 3
                ? "low_stock"
                : "available";

    /// <summary>Sums vendor stock for one catalog product (ignores negative rows).</summary>
    public static int SumAvailable(IEnumerable<int> quantities)
    {
        var total = 0;
        foreach (var q in quantities)
            total += Math.Max(0, q);
        return total;
    }

    /// <summary>
    /// Sums packaging-size stock across vendors (same ProductVariantId = same 1 Kg / 500 g / 1 Ltr).
    /// </summary>
    public static Dictionary<Guid, int> SumByVariantId(
        IEnumerable<(Guid VariantId, int AvailableQuantity)> rows)
    {
        var dict = new Dictionary<Guid, int>();
        foreach (var (variantId, qty) in rows)
            dict[variantId] = dict.GetValueOrDefault(variantId) + Math.Max(0, qty);
        return dict;
    }
}
