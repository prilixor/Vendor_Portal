using Prilixor.VendorPortal.Domain.Vendors;

namespace Prilixor.VendorPortal.Application.Onboarding;

/// <summary>
/// Equipment vs chemicals catalog Excel rules.
/// Packaging-size variants belong to chemicals only — the equipment sample template has no Variants sheet.
/// </summary>
public static class CatalogExcelScope
{
    public static bool IncludeVariantsSheet(bool isChemicalTemplate) => isChemicalTemplate;

    public static List<Product> ProductsInCategories(
        IEnumerable<Product> products,
        IReadOnlyCollection<ProductCategory> categories)
    {
        var ids = categories.Select(c => c.Id).ToHashSet();
        return products.Where(p => ids.Contains(p.CategoryId)).ToList();
    }
}
